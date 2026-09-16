/**
 * Manages the single encrypted-sync vault: setup, lock state, password ops.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { vaultDb, deviceKeyStore } from '../services/vaultDb';
import { vaultApi } from '../services/vaultApi';
import {
    deriveKEK, unwrapDEK, wrapDEK, checkVerifier, BadPasswordError,
    generateDEK, makeVerifier, generateRecoveryKey,
    recoveryKeyFromDisplay, KDF_ALGO, KDF_ITERATIONS, bytesToB64,
} from '../services/vaultCrypto';
import { useAuth } from './AuthContext';

const VaultCtx = createContext(null);
export const useVault = () => {
    const ctx = useContext(VaultCtx);
    if (!ctx) throw new Error('useVault must be used inside <VaultProvider>');
    return ctx;
};

const NOTICE_KEY = 'aida-sync-notice';
const nowIso = () => new Date().toISOString();

const buildRecordFromServer = (sp) => ({
    id: 'vault',
    syncEnabled: true,
    serverVaultId: sp.profileId,
    kdf: sp.kdf,
    wrappedDek: sp.wrappedDek,
    wrappedDekRecovery: sp.wrappedDekRecovery,
    verifier: sp.verifier,
    deviceWrappedDek: null,
    createdAt: sp.createdAt || nowIso(),
    updatedAt: sp.updatedAt || nowIso(),
    lastSyncedVersion: 0,
    lastSyncedAt: null,
    lastSyncedConfig: {},
    lastSyncedChatIds: [],
    lastSyncedCounts: { chats: 0, projects: 0 },
    tombstones: [],
    lastSyncSignature: null,
});

export const VaultProvider = ({ children }) => {
    const { isAuthenticated, authLoading } = useAuth();
    const [vault, setVault] = useState(null);
    const [dek, setDek] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notice, setNoticeState] = useState(() => localStorage.getItem(NOTICE_KEY));

    const locked = Boolean(vault && !dek);

    const setNotice = useCallback((msg) => {
        if (msg) localStorage.setItem(NOTICE_KEY, msg);
        else localStorage.removeItem(NOTICE_KEY);
        setNoticeState(msg || null);
    }, []);

    const updateVault = useCallback(async (patch) => {
        const latest = (await vaultDb.get()) || vault;
        if (!latest) return null;
        const updated = { ...latest, ...patch, updatedAt: nowIso() };
        await vaultDb.put(updated);
        setVault(updated);
        return updated;
    }, [vault]);

    // Wrap the DEK with the non-extractable device key and store the blob on
    // the vault record, so this browser can unlock without the password.
    const persistDeviceUnlock = useCallback(async (extractableDek) => {
        const deviceKey = await deviceKeyStore.getOrCreate();
        const deviceWrappedDek = await wrapDEK(extractableDek, deviceKey);
        await updateVault({ deviceWrappedDek });
    }, [updateVault]);

    const unlockWithRecord = useCallback(async (record, password, { rememberDevice = true } = {}) => {
        const kek = await deriveKEK(password, record.kdf.salt, record.kdf.iterations);
        const dekKey = await unwrapDEK(record.wrappedDek, kek);
        if (!(await checkVerifier(dekKey, record.verifier))) throw new BadPasswordError();
        setDek(dekKey);
        if (rememberDevice) {
            try {
                // wrapKey needs an extractable copy. The in-memory DEK above
                // stays non-extractable.
                const extractableDek = await unwrapDEK(record.wrappedDek, kek, { extractable: true });
                await persistDeviceUnlock(extractableDek);
            } catch (e) {
                console.error('[Vault] Could not persist device unlock:', e);
            }
        }
        return dekKey;
    }, [persistDeviceUnlock]);

    useEffect(() => {
        if (authLoading) return;
        const load = async () => {
            setLoading(true);
            setDek(null);
            if (!isAuthenticated) {
                setVault(null);
                setLoading(false);
                return;
            }
            try {
                let record = await vaultDb.get();
                if (!record) {
                    try {
                        const list = await vaultApi.listProfiles();
                        const sp = (list || [])[0];
                        if (sp) {
                            record = buildRecordFromServer(sp);
                            await vaultDb.put(record);
                        }
                    } catch (e) {
                        console.error('[Vault] Failed to check server vault:', e);
                    }
                } else if (record.serverVaultId) {
                    try {
                        const list = await vaultApi.listProfiles();
                        const sp = (list || []).find(p => p.profileId === record.serverVaultId);
                        if (sp) {
                            record = {
                                ...record,
                                kdf: sp.kdf || record.kdf,
                                wrappedDek: sp.wrappedDek || record.wrappedDek,
                                wrappedDekRecovery: sp.wrappedDekRecovery || record.wrappedDekRecovery,
                                verifier: sp.verifier || record.verifier,
                                updatedAt: sp.updatedAt || record.updatedAt,
                            };
                            await vaultDb.put(record);
                        }
                    } catch (e) {
                        console.error('[Vault] Failed to refresh vault from server:', e);
                    }
                }

                // Silent unlock: if this device previously wrapped the DEK
                // with its device key, unlock without asking for a password.
                if (record?.deviceWrappedDek) {
                    try {
                        const deviceKey = await deviceKeyStore.get();
                        if (!deviceKey) throw new Error('Device key missing');
                        const dekKey = await unwrapDEK(record.deviceWrappedDek, deviceKey);
                        if (!(await checkVerifier(dekKey, record.verifier))) {
                            throw new Error('Verifier mismatch');
                        }
                        setDek(dekKey);
                    } catch {
                        // Device key gone or blob is stale. Clear it so the
                        // password prompt shows instead.
                        const cleaned = { ...record, deviceWrappedDek: null };
                        await vaultDb.put(cleaned);
                        record = cleaned;
                    }
                }

                setVault(record || null);
                // A vault exists, so any persisted "sync is off" notice left
                // over from a previous disable is stale.
                if (record) setNotice(null);
            } catch (e) {
                console.error('[Vault] Failed to load vault:', e);
                setVault(null);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isAuthenticated, authLoading, setNotice]);

    const removeVault = useCallback(async () => {
        await vaultDb.remove();
        await deviceKeyStore.remove();
        setVault(null);
        setDek(null);
    }, []);

    const enableSync = useCallback(async ({ password }) => {
        const dekKey = await generateDEK();
        const salt = bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
        const kek = await deriveKEK(password, salt);
        const wrappedDek = await wrapDEK(dekKey, kek);
        const verifier = await makeVerifier(dekKey);
        const recovery = await generateRecoveryKey();
        const wrappedDekRecovery = await wrapDEK(dekKey, recovery.key);
        const now = nowIso();

        const record = {
            id: 'vault',
            syncEnabled: true,
            serverVaultId: null,
            kdf: { algo: KDF_ALGO, iterations: KDF_ITERATIONS, salt },
            wrappedDek,
            wrappedDekRecovery,
            verifier,
            deviceWrappedDek: null,
            createdAt: now,
            updatedAt: now,
            lastSyncedVersion: 0,
            lastSyncedAt: null,
            lastSyncedConfig: {},
            lastSyncedChatIds: [],
            lastSyncedCounts: { chats: 0, projects: 0 },
            tombstones: [],
            lastSyncSignature: null,
        };

        try {
            const sp = await vaultApi.createProfile({
                name: 'Encrypted Sync',
                appId: 'aida',
                kdf: record.kdf,
                wrappedDek,
                wrappedDekRecovery,
                verifier,
            });
            record.serverVaultId = sp.profileId;
        } catch (e) {
            if (e.status === 409) {
                const list = await vaultApi.listProfiles();
                const sp = (list || [])[0];
                if (!sp) throw new Error('A vault already exists but could not be loaded.');
                const adopted = buildRecordFromServer(sp);
                await vaultDb.put(adopted);
                setVault(adopted);
                setNotice(null); // sync is on again, stale "off" notice is cleared
                try {
                    await unlockWithRecord(adopted, password);
                    return { adopted: true, unlocked: true };
                } catch {
                    return { adopted: true, unlocked: false };
                }
            }
            throw e;
        }

        await vaultDb.put(record);
        setVault(record);
        setDek(dekKey);
        setNotice(null); // sync is on again, stale "off" notice is cleared
        try {
            // dekKey from generateDEK() is extractable, so it can be wrapped
            // for this device immediately.
            await persistDeviceUnlock(dekKey);
        } catch (e) {
            console.error('[Vault] Could not persist device unlock:', e);
        }
        return { recoveryKey: recovery.display };
    }, [unlockWithRecord, persistDeviceUnlock, setNotice]);

    const unlock = useCallback(async (password, opts) => {
        const record = await vaultDb.get();
        if (!record) throw new Error('Encrypted sync is not set up on this device.');
        await unlockWithRecord(record, password, opts);
        setVault(await vaultDb.get());
    }, [unlockWithRecord]);

    const lock = useCallback(async () => {
        setDek(null);
        // Forget the device-wrapped DEK too, otherwise the next page load
        // would silently unlock again and Lock would mean nothing.
        const record = await vaultDb.get();
        if (record?.deviceWrappedDek) {
            await updateVault({ deviceWrappedDek: null });
        }
    }, [updateVault]);

    // Note: changePassword and resetWithRecovery re-wrap the SAME DEK under a
    // new KEK. The device-wrapped DEK stays valid, so no changes needed there.
    const changePassword = useCallback(async (currentPassword, newPassword) => {
        const record = await vaultDb.get();
        if (!record?.serverVaultId) throw new Error('Encrypted sync is not set up.');
        const kek = await deriveKEK(currentPassword, record.kdf.salt, record.kdf.iterations);
        const dekKey = await unwrapDEK(record.wrappedDek, kek, { extractable: true });
        if (!(await checkVerifier(dekKey, record.verifier))) throw new BadPasswordError();

        const newSalt = bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
        const newKek = await deriveKEK(newPassword, newSalt);
        const newWrappedDek = await wrapDEK(dekKey, newKek);
        const kdf = { algo: KDF_ALGO, iterations: KDF_ITERATIONS, salt: newSalt };

        await vaultApi.updateProfile(record.serverVaultId, {
            kdf,
            wrappedDek: newWrappedDek,
            verifier: record.verifier,
        });
        await updateVault({ kdf, wrappedDek: newWrappedDek });
    }, [updateVault]);

    const resetWithRecovery = useCallback(async (recoveryKeyDisplay, newPassword) => {
        const record = await vaultDb.get();
        if (!record?.serverVaultId) throw new Error('Encrypted sync is not set up.');

        const invalid = new Error('Invalid recovery key. Check it and try again.');
        let recoveryKey;
        try {
            recoveryKey = await recoveryKeyFromDisplay(recoveryKeyDisplay);
        } catch { throw invalid; }
        let dekKey;
        try {
            dekKey = await unwrapDEK(record.wrappedDekRecovery, recoveryKey, { extractable: true });
        } catch { throw invalid; }
        if (!(await checkVerifier(dekKey, record.verifier))) throw invalid;

        const newSalt = bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
        const newKek = await deriveKEK(newPassword, newSalt);
        const newWrappedDek = await wrapDEK(dekKey, newKek);
        const kdf = { algo: KDF_ALGO, iterations: KDF_ITERATIONS, salt: newSalt };

        await vaultApi.updateProfile(record.serverVaultId, {
            kdf,
            wrappedDek: newWrappedDek,
            verifier: record.verifier,
        });
        await updateVault({ kdf, wrappedDek: newWrappedDek });

        const newDek = await unwrapDEK(newWrappedDek, newKek);
        setDek(newDek);
    }, [updateVault]);

    const resetBackup = useCallback(async () => {
        const record = await vaultDb.get();
        if (record?.serverVaultId) {
            try {
                await vaultApi.deleteProfile(record.serverVaultId);
            } catch (e) {
                if (e.status !== 404) throw e;
            }
        }
        await removeVault();
    }, [removeVault]);

    const value = {
        vault, dek, locked, loading, notice,
        setNotice, enableSync, unlock, lock,
        updateVault, removeVault,
        changePassword, resetWithRecovery, resetBackup,
    };

    return <VaultCtx.Provider value={value}>{children}</VaultCtx.Provider>;
};