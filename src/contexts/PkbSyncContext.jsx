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

const REMEMBER_KEY = 'aida_pkb_pw_enc';
const encoder = new TextEncoder();

function randomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function deriveKeyFromToken(token) {
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(token));
    return crypto.subtle.importKey(
        'raw',
        hash,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptWithToken(text, token) {
    const key = await deriveKeyFromToken(token);
    const iv = randomBytes(12);
    const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(text)
    );
    return JSON.stringify({
        iv: bytesToBase64(iv),
        ct: bytesToBase64(new Uint8Array(ct)),
    });
}

async function decryptWithToken(envelope, token) {
    const { iv, ct } = JSON.parse(envelope);
    const key = await deriveKeyFromToken(token);
    const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(iv) },
        key,
        base64ToBytes(ct)
    );
    return new TextDecoder().decode(pt);
}

export const PkbSyncProvider = ({ children }) => {
    const { isAuthenticated, authLoading, apiToken } = useAuth();

    const [vaultExists, setVaultExists] = useState(false);
    const [dek, setDek] = useState(null);
    const [syncStatus, setSyncStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [rememberedPw, setRememberedPw] = useState(
        () => Boolean(localStorage.getItem(REMEMBER_KEY))
    );

    const statusRef = useRef('');

    const setStatus = useCallback((message) => {
        statusRef.current = message;
        setSyncStatus(message);
    }, []);

    // Check whether a vault exists for this account
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

    // Start/stop the sync engine when the DEK is available
    useEffect(() => {
        if (!isAuthenticated || !apiToken || !dek) {
            stopPkbSync();
            return;
        }

        startPkbSync({ token: apiToken, dek, onStatus: setStatus });
        return () => stopPkbSync();
    }, [isAuthenticated, apiToken, dek, setStatus]);

    
    const forgetPassword = useCallback(() => {
        localStorage.removeItem(REMEMBER_KEY);
        setRememberedPw(false);
    }, []);


    // Clear remembered password on sign out
    useEffect(() => {
        if (!isAuthenticated && !authLoading) forgetPassword();
    }, [isAuthenticated, authLoading, forgetPassword]);

    // Try to auto-unlock when we know a vault exists and have a token
    useEffect(() => {
        if (loading || !vaultExists || dek || !apiToken) return;
        tryAutoUnlock();
    }, [loading, vaultExists, dek, apiToken]);

    const rememberPassword = useCallback(async (password) => {
        if (!apiToken) return;
        try {
            const enc = await encryptWithToken(password, apiToken);
            localStorage.setItem(REMEMBER_KEY, enc);
            setRememberedPw(true);
        } catch (error) {
            console.error('Failed to remember password:', error);
        }
    }, [apiToken]);

    const tryAutoUnlock = useCallback(async () => {
        if (!apiToken || !vaultExists || dek) return;
        const enc = localStorage.getItem(REMEMBER_KEY);
        if (!enc) return;

        try {
            const password = await decryptWithToken(enc, apiToken);
            await unlockVault(password);
        } catch (error) {
            console.warn('Auto unlock failed, clearing remembered password:', error);
            forgetPassword();
        }
    }, [apiToken, vaultExists, dek, forgetPassword]);

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
        forgetPassword(); 
        setDek(null);
        setStatus('Sync locked.');
    }, [setStatus]);

    const disableSync = useCallback(async () => {
        if (!apiToken) throw new Error('Not authenticated');
        await syncNow();
        await deletePkbVault(apiToken);
        await clearLocalPkbData();
        stopPkbSync();
        forgetPassword();
        setDek(null);
        setVaultExists(false);
    }, [apiToken, forgetPassword]);

    const requestSync = useCallback((delayMs = 1500) => {
        requestPkbSync(delayMs);
    }, []);

    const removeLocalData = useCallback(async () => {
        await syncNow();
        stopPkbSync();
        await clearLocalPkbData();
        forgetPassword();
        setDek(null);
    }, [forgetPassword]);

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
        rememberPassword,
        forgetPassword,
        hasRememberedPassword: rememberedPw,
    };

    return (
        <PkbSyncContext.Provider value={value}>
            {children}
        </PkbSyncContext.Provider>
    );
};