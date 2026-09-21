// src/contexts/PkbSyncContext.jsx
import React, {
    createContext, useContext, useState, useCallback, useEffect, useRef,
} from 'react';
import { useAuth } from './AuthContext';
import {
    getPkbVaultStatus,
    createPkbVault,
    unlockPkbVault,
    resetPasswordWithRecovery,
    changePkbPassword,
    deletePkbVault,
    clearLocalPkbData,
    startPkbSync,
    stopPkbSync,
    requestPkbSync,
    syncNow,
} from '../services/pkbSync';

const PkbSyncContext = createContext(null);
export const usePkbSync = () => useContext(PkbSyncContext);

export const PkbSyncProvider = ({ children }) => {
    const { isAuthenticated, apiToken } = useAuth();

    const [vaultExists, setVaultExists] = useState(false);
    const [dek, setDek] = useState(null);
    const [syncStatus, setSyncStatus] = useState('');
    const [loading, setLoading] = useState(true);

    const statusRef = useRef('');

    const setStatus = useCallback((message) => {
        statusRef.current = message;
        setSyncStatus(message);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const check = async () => {
            setLoading(true);
            try {
                if (!isAuthenticated || !apiToken) {
                    setVaultExists(false);
                    setDek(null);
                    return;
                }
                const exists = await getPkbVaultStatus(apiToken);
                if (!cancelled) setVaultExists(exists);
            } catch (error) {
                console.error('PKB vault status check failed:', error);
                if (!cancelled) setVaultExists(false);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        check();
        return () => { cancelled = true; };
    }, [isAuthenticated, apiToken]);

    useEffect(() => {
        if (!isAuthenticated || !apiToken || !dek) {
            stopPkbSync();
            return;
        }

        startPkbSync({ token: apiToken, dek, onStatus: setStatus });
        return () => stopPkbSync();
    }, [isAuthenticated, apiToken, dek, setStatus]);

    const createVault = useCallback(async (password) => {
        if (!apiToken) throw new Error('Not authenticated');
        const result = await createPkbVault(apiToken, password);
        setDek(result.dek);
        setVaultExists(true);
        return result;
    }, [apiToken]);

    const unlockVault = useCallback(async (password) => {
        if (!apiToken) throw new Error('Not authenticated');
        const result = await unlockPkbVault(apiToken, password);
        setDek(result.dek);
        setVaultExists(true);
        return result;
    }, [apiToken]);

    const resetPassword = useCallback(async (recoveryKey, newPassword) => {
        if (!apiToken) throw new Error('Not authenticated');
        const result = await resetPasswordWithRecovery(apiToken, recoveryKey, newPassword);
        setDek(result.dek);
        return result;
    }, [apiToken]);

    const changePassword = useCallback(async (currentPassword, newPassword) => {
        if (!apiToken) throw new Error('Not authenticated');
        const result = await changePkbPassword(apiToken, currentPassword, newPassword);
        setDek(result.dek);
        return result;
    }, [apiToken]);

    const lockVault = useCallback(() => {
        stopPkbSync();
        setDek(null);
        setStatus('Sync locked.');
    }, [setStatus]);

    const disableSync = useCallback(async () => {
        if (!apiToken) throw new Error('Not authenticated');
        await syncNow();
        await deletePkbVault(apiToken);
        await clearLocalPkbData();
        stopPkbSync();
        setDek(null);
        setVaultExists(false);
    }, [apiToken]);

    const requestSync = useCallback((delayMs = 1500) => {
        requestPkbSync(delayMs);
    }, []);

    const removeLocalData = useCallback(async () => {
        await syncNow();
        stopPkbSync();
        await clearLocalPkbData();
        setDek(null);
    }, []);

    const value = {
        vaultExists,
        dek,
        locked: vaultExists && !dek,
        loading,
        syncStatus,
        statusText: statusRef,
        createVault,
        unlockVault,
        resetPassword,
        changePassword,
        lockVault,
        disableSync,
        removeLocalData,
        syncNow,
        requestSync,
    };

    return (
        <PkbSyncContext.Provider value={value}>
            {children}
        </PkbSyncContext.Provider>
    );
};