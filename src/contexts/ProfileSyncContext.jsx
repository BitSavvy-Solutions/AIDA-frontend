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

const PASSWORD_HANDOFF_KEY = 'aida-password-handoff';

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

// Downloads and decrypts the current server snapshot.
// Returns null when the profile has no snapshot on the server yet.
const pullRemoteSnapshot = async (serverId, dek) => {
    const meta = await vaultApi.getSnapshotMeta(serverId);
    if (!meta.version) return null;
    const dl = await vaultApi.getSnapshotDownload(serverId);
    return decryptSnapshot(dek, await downloadBlob(dl.downloadUrl));
};

const hasLocalContent = (snap) =>
    (snap.idb?.chats?.length || 0) > 0 ||
    (snap.idb?.projects?.length || 0) > 0 ||
    Object.keys(snap.config || {}).length > 0;

export const ProfileSyncProvider = ({ children }) => {
    const {
        activeProfile, dek, updateActiveProfile,
        verifyProfilePassword, lockProfile, selectProfile,
    } = useProfile();
    const [status, setStatus] = useState('idle');
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [needsReload, setNeedsReload] = useState(false);
    const [remoteInfo, setRemoteInfo] = useState(null);
    const [switchState, setSwitchState] = useState(null);

    const syncingRef = useRef(false);
    const switchingRef = useRef(false);
    const syncFnRef = useRef(null);

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

    const afterSyncBookkeeping = useCallback(async (snapshot, version) => {
        await updateActiveProfile({
            lastSyncedVersion: version,
            lastSyncedAt: new Date().toISOString(),
            lastSyncedConfig: snapshot.config,
            lastSyncedChatIds: (snapshot.idb?.chats || []).map(c => c.id),
            lastSyncedCounts: {
                chats: (snapshot.idb?.chats || []).length,
                projects: (snapshot.idb?.projects || []).length,
            },
            tombstones: snapshot.tombstones || [],
            lastSyncSignature: await computeLocalSignature(),
            needsHydration: false,
        });
    }, [updateActiveProfile]);

    const sync = useCallback(async (attempt = 1) => {
        const record = activeProfile;

        if (!record) {
            console.debug('[ProfileSync] skipped: no active profile');
            return;
        }
        if (!record.syncEnabled) {
            console.debug('[ProfileSync] skipped: sync disabled for this profile');
            return;
        }
        if (!record.serverProfileId) {
            console.warn('[ProfileSync] skipped: profile has no serverProfileId');
            setSyncError('Profile is not linked to the server.');
            return;
        }
        if (!dek) {
            console.warn('[ProfileSync] skipped: profile is locked, unlock it to sync');
            setSyncError('Profile is locked. Unlock it to sync.');
            return;
        }
        if (syncingRef.current || switchingRef.current) return;

        syncingRef.current = true;
        setStatus('syncing');
        setSyncError(null);

        const serverId = record.serverProfileId;
        try {
            console.log(`[ProfileSync] starting (attempt ${attempt}) for "${record.name}"`);
            const meta = await vaultApi.getSnapshotMeta(serverId);
            setRemoteInfo(meta);
            const signature = await computeLocalSignature();
            const dirty = signature !== record.lastSyncSignature;
            const knownVersion = record.lastSyncedVersion ?? 0;
            const hydrating = Boolean(record.needsHydration);

            if (hydrating) {
                // The workspace was cleared for a profile switch and the
                // pre-reload restore did not finish. Pull the server state
                // back down. We must NEVER push from this state: the empty
                // local snapshot would wipe the server copy. If anything
                // below fails, needsHydration stays true and the next tick
                // retries safely.
                let remoteSnapshot = null;
                if (meta.version > 0) {
                    const dl = await vaultApi.getSnapshotDownload(serverId);
                    remoteSnapshot = await decryptSnapshot(dek, await downloadBlob(dl.downloadUrl));
                }
                // assumeCleared: missing chats/config are a side effect of
                // the switch, not user deletions, so no tombstones may be
                // fabricated here.
                const localSnapshot = await harvest(record, { assumeCleared: true });
                const merged = remoteSnapshot
                    ? mergeSnapshots(localSnapshot, remoteSnapshot)
                    : localSnapshot;
                const { configChanged } = await applySnapshot(merged);
                let version = meta.version;
                if (hasLocalContent(localSnapshot)) {
                    // Something was created locally while the profile was
                    // locked. Upload the union so it is not lost.
                    const committed = await pushSnapshot(record, merged, meta.version);
                    version = committed.version;
                }
                await afterSyncBookkeeping(merged, version);
                if (configChanged) setNeedsReload(true);
            } else if (meta.version === knownVersion && !dirty) {
                // Fully in sync, nothing to do.
            } else if (meta.version === knownVersion) {
                // Local dirty, server unchanged: normal push.
                const snapshot = await harvest(record);
                const committed = await pushSnapshot(record, snapshot, meta.version);
                await afterSyncBookkeeping(snapshot, committed.version);
            } else {
                // Server is ahead.
                const dl = await vaultApi.getSnapshotDownload(serverId);
                const remoteSnapshot = await decryptSnapshot(dek, await downloadBlob(dl.downloadUrl));

                if (!dirty) {
                    const { configChanged } = await applySnapshot(remoteSnapshot);
                    await afterSyncBookkeeping(remoteSnapshot, meta.version);
                    if (configChanged) setNeedsReload(true);
                } else {
                    const localSnapshot = await harvest(record);
                    const merged = mergeSnapshots(localSnapshot, remoteSnapshot);
                    const { configChanged } = await applySnapshot(merged);
                    try {
                        const committed = await pushSnapshot(record, merged, meta.version);
                        await afterSyncBookkeeping(merged, committed.version);
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
        let target;
        try {
            // 1. Verify the password BEFORE touching any data.
            setSwitchState({ phase: 'checking', message: 'Verifying password...' });
            const verified = await verifyProfilePassword(targetProfileId, password);
            target = verified.record;
            const targetDek = verified.dek;

            // 2. Finish syncing the outgoing profile.
            if (activeProfile && dek) {
                const info = await countPendingItems(activeProfile);
                if (info.dirty && activeProfile.syncEnabled && activeProfile.serverProfileId) {
                    setSwitchState({
                        phase: 'syncing',
                        message: `Finishing sync for "${activeProfile.name}"...`,
                        total: info.local,
                        done: Math.min(info.synced, info.local),
                    });
                    await syncFnRef.current?.();
                    const fresh = await profilesDb.get(activeProfile.id);
                    const recheck = await countPendingItems(fresh || activeProfile);
                    if (recheck.dirty) {
                        throw new Error('Sync did not finish. Switch aborted, nothing was deleted.');
                    }
                }
            }

            // 3. Block background syncs during the switch.
            switchingRef.current = true;

            // 4. Pull the target snapshot BEFORE wiping anything.
            let remoteSnapshot = null;
            let serverMeta = { version: 0 };
            if (target.syncEnabled && target.serverProfileId) {
                setSwitchState({ phase: 'syncing', message: `Loading "${target.name}" from the server...` });
                serverMeta = await vaultApi.getSnapshotMeta(target.serverProfileId);
                if (serverMeta.version > 0) {
                    const dl = await vaultApi.getSnapshotDownload(target.serverProfileId);
                    remoteSnapshot = await decryptSnapshot(targetDek, await downloadBlob(dl.downloadUrl));
                }
            }

            // 5. Wipe the local workspace.
            setSwitchState({ phase: 'clearing', message: 'Preparing a clean workspace...' });
            await clearLocalData();

            // 6. Restore the target's data.
            let hydrated = remoteSnapshot === null;
            if (remoteSnapshot) {
                await applySnapshot(remoteSnapshot);
                hydrated = true;
            }

            // 7. Write fresh bookkeeping so the first post-reload sync no-ops.
            const localSnapshot = await harvest(target, { assumeCleared: true });
            const updatedRecord = {
                ...target,
                lastSyncedVersion: serverMeta.version,
                lastSyncedAt: new Date().toISOString(),
                lastSyncedConfig: localSnapshot.config,
                lastSyncedChatIds: (localSnapshot.idb?.chats || []).map(c => c.id),
                lastSyncedCounts: {
                    chats: (localSnapshot.idb?.chats || []).length,
                    projects: (localSnapshot.idb?.projects || []).length,
                },
                tombstones: localSnapshot.tombstones || [],
                lastSyncSignature: await computeLocalSignature(),
                needsHydration: !hydrated,
            };
            await profilesDb.put(updatedRecord);

            // 8. Hand the password through the reload. It is deleted
            //    immediately on the next page load, so it only exists for
            //    one navigation. The DEK itself never leaves memory.
            sessionStorage.setItem(PASSWORD_HANDOFF_KEY, JSON.stringify({
                profileId: targetProfileId,
                password,
            }));
            selectProfile(targetProfileId);

            // 9. Reload. The widget re-initializes and the profile is
            //    unlocked automatically with the handed-off password.
            setSwitchState({ phase: 'reloading', message: `Switching to "${targetName || target.name}"...` });
            window.location.reload();
        } catch (e) {
            switchingRef.current = false;
            setSwitchState(null);
            throw e;
        }
    }, [activeProfile, dek, verifyProfilePassword, selectProfile]);

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
    }, [activeProfile?.id, activeProfile?.syncEnabled, dek]);

    const value = {
        status,
        lastSyncedAt,
        syncError,
        needsReload,
        remoteInfo,
        syncNow: () => syncFnRef.current?.(),
        dismissReload: () => setNeedsReload(false),
        switchToProfile,
        switchState,
    };

    return <ProfileSyncCtx.Provider value={value}>{children}</ProfileSyncCtx.Provider>;
};