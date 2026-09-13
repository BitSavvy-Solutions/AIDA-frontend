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
import { useAuth } from './AuthContext';

const ProfileCtx = createContext(null);
export const useProfile = () => {
    const ctx = useContext(ProfileCtx);
    if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
    return ctx;
};

const ACTIVE_PROFILE_KEY = 'aida-active-profile';
const PASSWORD_HANDOFF_KEY = 'aida-password-handoff';

export const ProfileProvider = ({ children }) => {
    const { isAuthenticated, authLoading } = useAuth();
    const [profiles, setProfiles] = useState([]);
    const [activeProfile, setActiveProfile] = useState(null);
    const [dek, setDek] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // A restored-but-not-unlocked profile is active but locked.
    const locked = Boolean(activeProfile && !dek);

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

                        const result = local.filter(p => !p.serverProfileId);
                        const now = new Date().toISOString();

                        for (const sp of serverProfiles) {
                            const existing = localByServerId.get(sp.profileId);
                            if (existing) {
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
                                    lastSyncedAt: null,
                                    lastSyncedConfig: {},
                                    lastSyncedChatIds: [],
                                    lastSyncedCounts: { chats: 0, projects: 0 },
                                    tombstones: [],
                                    lastSyncSignature: null,
                                });
                            }
                        }

                        // Remove orphaned local-only profiles whose name is already
                        // covered by a server-linked profile.
                        const serverNames = new Set(
                            result.filter(p => p.serverProfileId).map(p => p.name)
                        );
                        const deduped = [];
                        const removed = [];
                        for (const p of result) {
                            if (!p.serverProfileId && serverNames.has(p.name)) {
                                removed.push(p.id);
                            } else {
                                deduped.push(p);
                            }
                        }
                        await Promise.all(deduped.map(p => profilesDb.put(p)));
                        await Promise.all(removed.map(id => profilesDb.remove(id)));
                        merged = await profilesDb.getAll();
                    } catch (e) {
                        console.error('Failed to sync profiles from server:', e);
                    }
                }

                // Cleanup: drop duplicate entries pointing at the same server profile.
                // Older builds could accumulate these.
                const seenServerIds = new Set();
                const kept = [];
                const dupeIds = [];
                for (const p of merged) {
                    if (p.serverProfileId) {
                        if (seenServerIds.has(p.serverProfileId)) {
                            dupeIds.push(p.id);
                            continue;
                        }
                        seenServerIds.add(p.serverProfileId);
                    }
                    kept.push(p);
                }
                if (dupeIds.length) {
                    await Promise.all(dupeIds.map(id => profilesDb.remove(id)));
                    merged = kept;
                }

                setProfiles(merged);
                const activeId = localStorage.getItem(ACTIVE_PROFILE_KEY);
                if (activeId) {
                    const active = merged.find(p => p.id === activeId);
                    if (active) {
                        // If this page load is the result of a profile switch, the
                        // password was handed off in sessionStorage. Use it to unlock
                        // automatically, then discard it.
                        const handoffJson = sessionStorage.getItem(PASSWORD_HANDOFF_KEY);
                        if (handoffJson) {
                            sessionStorage.removeItem(PASSWORD_HANDOFF_KEY);
                            try {
                                const { profileId, password } = JSON.parse(handoffJson);
                                if (profileId === active.id) {
                                    await unlockProfile(active.id, password);
                                } else {
                                    setActiveProfile(active);
                                }
                            } catch (e) {
                                console.warn('[Profile] Auto-unlock failed, profile locked:', e);
                                setActiveProfile(active);
                            }
                        } else {
                            setActiveProfile(active);
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to load profiles:', e);
            } finally {
                setLoading(false);
            }
        };

        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    /**
     * Writes bookkeeping into IndexedDB AND back into React state, so badges
     * and signatures stay in sync with what is on disk.
     */
    const updateActiveProfile = useCallback(async (patch) => {
        if (!activeProfile?.id) return null;
        const latest = (await profilesDb.get(activeProfile.id)) || activeProfile;
        const updated = { ...latest, ...patch, updatedAt: new Date().toISOString() };
        await profilesDb.put(updated);
        setProfiles(prev => prev.map(p => (p.id === updated.id ? updated : p)));
        setActiveProfile(prev => (prev && prev.id === updated.id ? updated : prev));
        return updated;
    }, [activeProfile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

            const localProfileId = 'prof_local_' + crypto.randomUUID().replace(/-/g, '');
            const now = new Date().toISOString();

            const record = {
                id: localProfileId,
                name,
                syncEnabled: Boolean(syncEnabled),
                serverProfileId: null,
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

            if (syncEnabled) {
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


    /**
     * Checks a password against a profile WITHOUT changing any state.
     * The switch gate uses this so a wrong password can never destroy data.
     */
    const verifyProfilePassword = useCallback(async (profileId, password) => {
        const record = await profilesDb.get(profileId);
        if (!record) throw new Error('Profile not found');
        const kek = await deriveKEK(password, record.kdf.salt, record.kdf.iterations);
        const dekKey = await unwrapDEK(record.wrappedDek, kek);
        if (!(await checkVerifier(dekKey, record.verifier))) throw new BadPasswordError();
        return { record, dek: dekKey };
    }, []);

    const unlockProfile = useCallback(async (profileId, password) => {
        setError(null);
        try {
            const { record, dek: dekKey } = await verifyProfilePassword(profileId, password);
            setDek(dekKey);
            setActiveProfile(record);
            localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
            return { record, dek: dekKey };
        } catch (e) {
            setError(e.message);
            throw e;
        }
    }, [verifyProfilePassword]);

    const lockProfile = useCallback(() => {
        setDek(null);
        setActiveProfile(null);
        localStorage.removeItem(ACTIVE_PROFILE_KEY);
    }, []);

    /**
    * Makes a profile the active one for the next page load, without unlocking it.
    */
    const selectProfile = useCallback((profileId) => {
        localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
    }, []);

    const value = {
        profiles,
        activeProfile,
        dek,
        locked,
        loading,
        error,
        createProfile,
        verifyProfilePassword,
        unlockProfile,
        lockProfile,
        selectProfile,
        refreshProfiles,
        updateActiveProfile,
    };

    return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>;
};