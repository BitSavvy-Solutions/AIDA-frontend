/**
 * Manages the active profile, unlock state, and profile switching.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { profilesDb } from '../services/profilesDb';
import { vaultApi } from '../services/vaultApi';
import {
    deriveKEK, unwrapDEK, checkVerifier, BadPasswordError,
    generateDEK, wrapDEK, makeVerifier, generateRecoveryKey,
    KDF_ALGO, KDF_ITERATIONS, bytesToB64,
} from '../services/vaultCrypto';
import { harvest, applySnapshot } from '../services/snapshot';
import { useAuth } from './AuthContext';

const ProfileCtx = createContext(null);
export const useProfile = () => {
    const ctx = useContext(ProfileCtx);
    if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
    return ctx;
};

const ACTIVE_PROFILE_KEY = 'aida-active-profile';

export const ProfileProvider = ({ children }) => {
    const { isAuthenticated, authLoading } = useAuth();
    const [profiles, setProfiles] = useState([]);
    const [activeProfile, setActiveProfile] = useState(null);
    const [dek, setDek] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load profiles from local DB and merge with server on login
    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const local = await profilesDb.getAll();
                let merged = local;

                if (isAuthenticated) {
                    try {
                        const serverProfiles = await vaultApi.listProfiles();
                        const localByServerId = new Map(
                            local.filter(p => p.serverProfileId).map(p => [p.serverProfileId, p])
                        );

                        // Keep purely local profiles (no server id)
                        const result = local.filter(p => !p.serverProfileId);
                        const now = new Date().toISOString();

                        for (const sp of serverProfiles) {
                            const existing = localByServerId.get(sp.profileId);
                            if (existing) {
                                // Update server-controlled fields, keep local bookkeeping
                                result.push({
                                    ...existing,
                                    name: sp.name || existing.name,
                                    kdf: sp.kdf || existing.kdf,
                                    wrappedDek: sp.wrappedDek || existing.wrappedDek,
                                    wrappedDekRecovery: sp.wrappedDekRecovery || existing.wrappedDekRecovery,
                                    verifier: sp.verifier || existing.verifier,
                                    updatedAt: sp.updatedAt || existing.updatedAt,
                                });
                            } else {
                                // Server profile not seen locally yet; create a local registry entry
                                result.push({
                                    id: 'prof_local_' + crypto.randomUUID().replace(/-/g, ''),
                                    name: sp.name,
                                    serverProfileId: sp.profileId,
                                    syncEnabled: true,
                                    kdf: sp.kdf,
                                    wrappedDek: sp.wrappedDek,
                                    wrappedDekRecovery: sp.wrappedDekRecovery,
                                    verifier: sp.verifier,
                                    createdAt: sp.createdAt || now,
                                    updatedAt: sp.updatedAt || now,
                                    lastSyncedVersion: 0,
                                    lastSyncedConfig: {},
                                    lastSyncedChatIds: [],
                                    tombstones: [],
                                    lastSyncSignature: null,
                                });
                            }
                        }

                        await Promise.all(result.map(p => profilesDb.put(p)));
                        merged = await profilesDb.getAll();
                    } catch (e) {
                        console.error('Failed to sync profiles from server:', e);
                    }
                }

                setProfiles(merged);
                const activeId = localStorage.getItem(ACTIVE_PROFILE_KEY);
                if (activeId) {
                    const active = merged.find(p => p.id === activeId);
                    if (active) setActiveProfile(active);
                }
            } catch (e) {
                console.error('Failed to load profiles:', e);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [isAuthenticated]);

    // Lock profile when user logs out
    useEffect(() => {
        if (!authLoading && !isAuthenticated && activeProfile) {
            lockProfile();
        }
    }, [isAuthenticated, authLoading, activeProfile]);

    const refreshProfiles = useCallback(async () => {
        const local = await profilesDb.getAll();
        setProfiles(local);
        return local;
    }, []);

    const createProfile = useCallback(async ({ name, password, syncEnabled }) => {
        setError(null);
        try {
            const dekKey = await generateDEK();
            const salt = bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
            const kek = await deriveKEK(password, salt);
            const wrappedDek = await wrapDEK(dekKey, kek);
            const verifier = await makeVerifier(dekKey);
            const recovery = await generateRecoveryKey();
            const wrappedDekRecovery = await wrapDEK(dekKey, recovery.key);

            // Local id: client-side only, used for the local registry
            const localProfileId = 'prof_local_' + crypto.randomUUID().replace(/-/g, '');
            const now = new Date().toISOString();

            const record = {
                id: localProfileId,
                name,
                syncEnabled: Boolean(syncEnabled),
                serverProfileId: null,   // filled in below if sync enabled
                kdf: { algo: KDF_ALGO, iterations: KDF_ITERATIONS, salt },
                wrappedDek,
                wrappedDekRecovery,
                verifier,
                createdAt: now,
                updatedAt: now,
                lastSyncedVersion: 0,
                lastSyncedConfig: {},
                lastSyncedChatIds: [],
                tombstones: [],
                lastSyncSignature: null,
            };

            if (syncEnabled) {
                // Register on server. Server generates its own id.
                const serverProfile = await vaultApi.createProfile({
                    name,
                    appId: 'aida', 
                    kdf: record.kdf,
                    wrappedDek,
                    wrappedDekRecovery,
                    verifier,
                });
                record.serverProfileId = serverProfile.profileId;
            }

            await profilesDb.put(record);
            await refreshProfiles();
            return { record, recoveryKey: recovery.display };
        } catch (e) {
            setError(e.message);
            throw e;
        }
    }, [refreshProfiles]);

    const unlockProfile = useCallback(async (profileId, password) => {
        setError(null);
        try {
            const record = await profilesDb.get(profileId);
            if (!record) throw new Error('Profile not found');

            const kek = await deriveKEK(password, record.kdf.salt, record.kdf.iterations);
            const dekKey = await unwrapDEK(record.wrappedDek, kek);
            const ok = await checkVerifier(dekKey, record.verifier);
            if (!ok) throw new BadPasswordError();

            setDek(dekKey);
            setActiveProfile(record);
            localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
            return { record, dek: dekKey };
        } catch (e) {
            setError(e.message);
            throw e;
        }
    }, []);

    const lockProfile = useCallback(() => {
        setDek(null);
        setActiveProfile(null);
        localStorage.removeItem(ACTIVE_PROFILE_KEY);
    }, []);

    const switchProfile = useCallback(async (targetProfileId, password) => {
        // Harvest current profile if unlocked
        if (activeProfile && dek) {
            const snapshot = await harvest(activeProfile);
            await applySnapshot(snapshot); // no-op, just to be safe
        }
        await unlockProfile(targetProfileId, password);
        window.location.reload();
    }, [activeProfile, dek, unlockProfile]);

    const value = {
        profiles,
        activeProfile,
        dek,
        loading,
        error,
        createProfile,
        unlockProfile,
        lockProfile,
        switchProfile,
        refreshProfiles,
    };

    return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>;
};