/**
 * Manages the single encrypted-sync vault: setup, lock state, password ops.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { vaultDb } from '../services/vaultDb';
import { vaultApi } from '../services/vaultApi';
import {
    deriveKEK, unwrapDEK, checkVerifier, BadPasswordError,
    generateDEK, wrapDEK, makeVerifier, generateRecoveryKey,
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

    const unlockWithRecord = useCallback(async (record, password) => {
        const kek = await deriveKEK(password, record.kdf.salt, record.kdf.iterations);
        const dekKey = await unwrapDEK(record.wrappedDek, kek);
        if (!(await checkVerifier(dekKey, record.verifier))) throw new BadPasswordError();
        setDek(dekKey);
        return dekKey;
    }, []);

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
                    // No local record. Adopt the server vault if one exists,
                    // for example when the user logs in on a new device.
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
                    // Refresh key material from the server so a password change
                    // made on another device keeps working here.
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
                setVault(record || null);
            } catch (e) {
                console.error('[Vault] Failed to load vault:', e);
                setVault(null);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isAuthenticated, authLoading]);

    const updateVault = useCallback(async (patch) => {
        const latest = (await vaultDb.get()) || vault;
        if (!latest) return null;
        const updated = { ...latest, ...patch, updatedAt: nowIso() };
        await vaultDb.put(updated);
        setVault(updated);
        return updated;
    }, [vault]);

    const removeVault = useCallback(async () => {
        await vaultDb.remove();
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
                // The account already has a vault. Adopt it instead of the
                // keys we just generated, then try the entered password.
                const list = await vaultApi.listProfiles();
                const sp = (list || [])[0];
                if (!sp) throw new Error('A vault already exists but could not be loaded.');
                const adopted = buildRecordFromServer(sp);
                await vaultDb.put(adopted);
                setVault(adopted);
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
        return { recoveryKey: recovery.display };
    }, [unlockWithRecord]);

    const unlock = useCallback(async (password) => {
        const record = await vaultDb.get();
        if (!record) throw new Error('Encrypted sync is not set up on this device.');
        await unlockWithRecord(record, password);
        setVault(record);
    }, [unlockWithRecord]);

    const lock = useCallback(() => setDek(null), []);

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

    // Last resort when both password and recovery key are lost. Deletes the
    // server backup only. Local data on this device is never touched.
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