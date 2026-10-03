/**
 * The sync engine. Runs on every page while the vault is unlocked.
 */
import React, {
    createContext, useContext, useState, useCallback, useEffect, useRef,
} from 'react';
import { vaultApi, uploadBlob, downloadBlob } from '../services/vaultApi';
import { encryptSnapshot, decryptSnapshot } from '../services/vaultCrypto';
import {
    harvest, mergeSnapshots, applySnapshot, computeLocalSignature,
} from '../services/snapshot';
import { useVault } from './VaultContext';

const TICK_MS = 120_000; // check for changes every 2 minutes
const MAX_MERGE_ATTEMPTS = 3;

const SyncCtx = createContext(null);
export const useSync = () => {
    const ctx = useContext(SyncCtx);
    if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
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

export const SyncProvider = ({ children }) => {
    const { vault, dek, updateVault, removeVault, setNotice } = useVault();
    const [status, setStatus] = useState('idle');
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [needsReload, setNeedsReload] = useState(false);
    const [remoteInfo, setRemoteInfo] = useState(null);
    const [disabling, setDisabling] = useState(false);

    const syncingRef = useRef(false);
    const syncFnRef = useRef(null);
    const dekRef = useRef(dek);
    useEffect(() => { dekRef.current = dek; }, [dek]);

    const pushSnapshot = useCallback(async (record, snapshot, baseVersion) => {
        const key = dekRef.current;
        if (!key) throw new Error('Vault is locked.');
        const buffer = await encryptSnapshot(key, snapshot);
        if (buffer.byteLength > 50 * 1024 * 1024) {
            throw new Error('Snapshot exceeds the 50 MB limit.');
        }
        const { reservationId, uploadUrl } = await vaultApi.presign(record.serverVaultId, buffer.byteLength, baseVersion);
        await uploadBlob(uploadUrl, buffer);
        return vaultApi.commit(record.serverVaultId, reservationId, baseVersion, getDeviceLabel());
    }, []);

    const afterSyncBookkeeping = useCallback(async (snapshot, version) => {
        await updateVault({
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
        });
    }, [updateVault]);

    // The backup was deleted on another device. Turn sync off locally and
    // tell the user. Local data is never touched.
    const handleServerVaultGone = useCallback(async () => {
        console.warn('[Sync] Server backup no longer exists. Turning sync off locally.');
        await removeVault();
        setNotice('The encrypted server backup was deleted on another device. Encrypted sync has been turned off here. Your local data is unchanged.');
        setRemoteInfo(null);
        setStatus('idle');
        setSyncError(null);
    }, [removeVault, setNotice]);

    const sync = useCallback(async (attempt = 1) => {
        const record = vault;
        if (!record?.syncEnabled || !record.serverVaultId) return;
        if (!dek) return; // locked, sync pauses until unlock
        if (syncingRef.current) return;

        syncingRef.current = true;
        setStatus('syncing');
        setSyncError(null);

        const serverId = record.serverVaultId;
        try {
            let meta;
            try {
                meta = await vaultApi.getSnapshotMeta(serverId);
            } catch (e) {
                if (e.status === 404) {
                    syncingRef.current = false;
                    await handleServerVaultGone();
                    return;
                }
                throw e;
            }
            setRemoteInfo(meta);

            const signature = await computeLocalSignature();
            const dirty = signature !== record.lastSyncSignature;
            const knownVersion = record.lastSyncedVersion ?? 0;

            if (meta.version === knownVersion && !dirty) {
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
            console.error('[Sync] failed:', err);
            setSyncError(err.message);
            setStatus('error');
        } finally {
            syncingRef.current = false;
        }
    }, [vault, dek, pushSnapshot, afterSyncBookkeeping, handleServerVaultGone]);

    // Disable = final download of anything missing, then permanent deletion
    // of the server backup, then removal of the local vault record.
    const disableSync = useCallback(async () => {
        const record = vault;
        if (!record?.serverVaultId) throw new Error('Encrypted sync is not set up.');
        if (!dek) throw new Error('Unlock encrypted sync first.');

        setDisabling(true);
        try {
            let meta = null;
            try {
                meta = await vaultApi.getSnapshotMeta(record.serverVaultId);
            } catch (e) {
                if (e.status !== 404) throw e;
            }

            if (meta?.version > 0) {
                const dl = await vaultApi.getSnapshotDownload(record.serverVaultId);
                const remoteSnapshot = await decryptSnapshot(dek, await downloadBlob(dl.downloadUrl));
                const localSnapshot = await harvest(record);
                const merged = mergeSnapshots(localSnapshot, remoteSnapshot);
                await applySnapshot(merged);
            }

            try {
                await vaultApi.deleteProfile(record.serverVaultId);
            } catch (e) {
                if (e.status !== 404) throw e;
            }

            await removeVault();
            setRemoteInfo(null);
            setLastSyncedAt(null);
            setStatus('idle');
            setSyncError(null);
        } finally {
            setDisabling(false);
        }
    }, [vault, dek, removeVault]);

    useEffect(() => { syncFnRef.current = sync; }, [sync]);

    useEffect(() => {
        if (!vault?.syncEnabled || !dek) return;

        syncFnRef.current?.();
        const interval = setInterval(() => syncFnRef.current?.(), TICK_MS);
        const onVisibility = () => { if (!document.hidden) syncFnRef.current?.(); };
        const onOnline = () => syncFnRef.current?.();
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('online', onOnline);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('online', onOnline);
        };
    }, [vault?.syncEnabled, vault?.serverVaultId, dek]);

    const value = {
        status, lastSyncedAt, syncError, needsReload, remoteInfo, disabling,
        syncNow: () => syncFnRef.current?.(),
        dismissReload: () => setNeedsReload(false),
        disableSync,
    };

    return <SyncCtx.Provider value={value}>{children}</SyncCtx.Provider>;
};