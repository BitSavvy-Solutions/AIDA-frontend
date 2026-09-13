/**
 * The sync engine. One active profile at a time.
 */
import React, {
    createContext, useContext, useState, useCallback, useEffect, useRef,
} from 'react';
import { vaultApi, uploadBlob, downloadBlob } from '../services/vaultApi';
import { encryptSnapshot, decryptSnapshot } from '../services/vaultCrypto';
import {
    harvest, mergeSnapshots, applySnapshot, computeLocalSignature,
    clearLocalData, countPendingItems,
} from '../services/snapshot';
import { profilesDb } from '../services/profilesDb';
import { useProfile } from './ProfileContext';

const TICK_MS = 60_000;
const MAX_MERGE_ATTEMPTS = 3;

const ProfileSyncCtx = createContext(null);
export const useProfileSync = () => {
    const ctx = useContext(ProfileSyncCtx);
    if (!ctx) throw new Error('useProfileSync must be used inside <ProfileSyncProvider>');
    return ctx;
};

const getDeviceLabel = () => {
    let label = localStorage.getItem('aida-device-label');
    if (label) return label;
    const ua = navigator.userAgent;
    const browser = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome'
        : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Browser';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac'
        : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : 'Linux';
    label = `${browser} on ${os}`;
    localStorage.setItem('aida-device-label', label);
    return label;
};

export const ProfileSyncProvider = ({ children }) => {
    const { activeProfile, dek, unlockProfile } = useProfile();
    const [status, setStatus] = useState('idle');
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [needsReload, setNeedsReload] = useState(false);
    const [remoteInfo, setRemoteInfo] = useState(null);
    const [switchState, setSwitchState] = useState(null);

    const syncingRef = useRef(false);
    const syncFnRef = useRef(null);

    const persistRecord = async (patch) => {
        const updated = { ...activeProfile, ...patch, updatedAt: new Date().toISOString() };
        await profilesDb.put(updated);
        return updated;
    };

    const pushSnapshot = useCallback(async (record, snapshot, baseVersion) => {
        const serverId = record.serverProfileId;
        if (!serverId) throw new Error('No server profile linked');

        const buffer = await encryptSnapshot(dek, snapshot);
        if (buffer.byteLength > 50 * 1024 * 1024) {
            throw new Error('Snapshot exceeds the 50 MB limit.');
        }
        const { reservationId, uploadUrl } = await vaultApi.presign(serverId, buffer.byteLength, baseVersion);
        await uploadBlob(uploadUrl, buffer);
        return vaultApi.commit(serverId, reservationId, baseVersion, getDeviceLabel());
    }, [dek]);

    const afterSyncBookkeeping = useCallback(async (record, snapshot, version) => {
        await persistRecord({
            lastSyncedVersion: version,
            lastSyncedConfig: snapshot.config,
            lastSyncedChatIds: (snapshot.idb?.chats || []).map(c => c.id),
            tombstones: snapshot.tombstones || [],
            lastSyncSignature: await computeLocalSignature(),
        });
    }, [activeProfile]); // eslint-disable-line react-hooks/exhaustive-deps

    const sync = useCallback(async (attempt = 1) => {
        const record = activeProfile;
        if (!record || !dek || !record.syncEnabled || syncingRef.current) return;
        if (!record.serverProfileId) return; // cannot sync without a server id

        syncingRef.current = true;
        setStatus('syncing');
        setSyncError(null);

        const serverId = record.serverProfileId;
        try {
            const meta = await vaultApi.getSnapshotMeta(serverId);
            setRemoteInfo(meta);
            const signature = await computeLocalSignature();
            const dirty = signature !== record.lastSyncSignature;
            const knownVersion = record.lastSyncedVersion ?? 0;

            if (meta.version === knownVersion && !dirty) {
                setStatus('success');
                setTimeout(() => setStatus(s => (s === 'success' ? 'idle' : s)), 3000);
                return;
            }

            if (meta.version === knownVersion && dirty) {
                const snapshot = await harvest(record);
                const committed = await pushSnapshot(record, snapshot, meta.version);
                await afterSyncBookkeeping(record, snapshot, committed.version);
            } else {
                const dl = await vaultApi.getSnapshotDownload(serverId);
                const remoteSnapshot = await decryptSnapshot(dek, await downloadBlob(dl.downloadUrl));

                if (!dirty) {
                    const { configChanged } = await applySnapshot(remoteSnapshot);
                    await afterSyncBookkeeping(record, remoteSnapshot, meta.version);
                    if (configChanged) setNeedsReload(true);
                } else {
                    const localSnapshot = await harvest(record);
                    const merged = mergeSnapshots(localSnapshot, remoteSnapshot);
                    const { configChanged } = await applySnapshot(merged);
                    try {
                        const committed = await pushSnapshot(record, merged, meta.version);
                        await afterSyncBookkeeping(record, merged, committed.version);
                    } catch (e) {
                        if (e.status === 409 && attempt < MAX_MERGE_ATTEMPTS) {
                            syncingRef.current = false;
                            return sync(attempt + 1);
                        }
                        throw e;
                    }
                    if (configChanged) setNeedsReload(true);
                }
            }

            setLastSyncedAt(new Date());
            setStatus('success');
            setTimeout(() => setStatus(s => (s === 'success' ? 'idle' : s)), 3000);
        } catch (err) {
            console.error('[ProfileSync] failed:', err);
            setSyncError(err.message);
            setStatus('error');
        } finally {
            syncingRef.current = false;
        }
    }, [activeProfile, dek, pushSnapshot, afterSyncBookkeeping]);

    const switchToProfile = useCallback(async (targetProfileId, password, targetName) => {
        // 1. If a profile is active, make sure we never delete unsynced data.
        if (activeProfile && dek) {
            setSwitchState({ phase: 'checking', message: 'Checking for unsynced changes...' });
            const info = await countPendingItems(activeProfile);
            if (info.dirty) {
                if (activeProfile.syncEnabled && activeProfile.serverProfileId) {
                    setSwitchState({
                        phase: 'syncing',
                        message: `Finishing sync for "${activeProfile.name}"...`,
                        total: info.local,
                        done: Math.min(info.synced, info.local),
                    });
                    await syncFnRef.current?.();
                    const recheck = await countPendingItems(activeProfile);
                    if (recheck.dirty) {
                        setSwitchState(null);
                        throw new Error('Sync did not finish. Switch aborted, nothing was deleted.');
                    }
                }
                // Local-only active profile cannot sync; UI warns before this runs.
            }
        }

        // 2. Wipe the previous profile's workspace.
        setSwitchState({ phase: 'clearing', message: 'Preparing a clean workspace...' });
        await clearLocalData();

        // 3. Unlock the target and reload so the widget remounts on empty state.
        setSwitchState({ phase: 'unlocking', message: `Unlocking "${targetName || 'profile'}"...` });
        await unlockProfile(targetProfileId, password);
        setSwitchState(null);
        window.location.reload();
    }, [activeProfile, dek, unlockProfile]);

    useEffect(() => { syncFnRef.current = sync; }, [sync]);

    useEffect(() => {
        if (!activeProfile?.syncEnabled || !dek) return;

        syncFnRef.current?.();
        const interval = setInterval(() => syncFnRef.current?.(), TICK_MS);
        const onVisibility = () => syncFnRef.current?.();
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [activeProfile?.id, activeProfile?.syncEnabled, dek]); // eslint-disable-line react-hooks/exhaustive-deps

    const value = {
        status, lastSyncedAt, syncError, needsReload, remoteInfo,
        syncNow: () => syncFnRef.current?.(),
        dismissReload: () => setNeedsReload(false),
        switchToProfile,
        switchState,
    };

    return <ProfileSyncCtx.Provider value={value}>{children}</ProfileSyncCtx.Provider>;
};