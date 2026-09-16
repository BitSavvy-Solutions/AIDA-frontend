// src/components/SignOutModal.jsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    FiX, FiLogOut, FiAlertTriangle, FiAlertCircle, FiRefreshCw,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useVault } from '../contexts/VaultContext';
import { useSync } from '../contexts/SyncContext';
import { vaultDb } from '../services/vaultDb';
import { clearLocalData, computeLocalSignature } from '../services/snapshot';
import { db } from '../services/db';

const SignOutModal = ({ isOpen, onClose, onSignedOut }) => {
    const { logout } = useAuth();
    const { dek } = useVault();
    const { syncNow, dismissReload } = useSync();

    const [removeLocal, setRemoveLocal] = useState(true); // removal is the default
    const [chatCount, setChatCount] = useState(null);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setRemoveLocal(true);
        setError('');
        setWorking(false);
        let alive = true;
        db.chats.getMeta()
            .then((m) => { if (alive) setChatCount(m.count); })
            .catch(() => {});
        return () => { alive = false; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setWorking(true);
        setError('');
        try {
            if (removeLocal) {
                // 1. Best effort: push unsynced changes so the server copy is
                //    as complete as possible before the wipe.
                if (dek) {
                    try { await syncNow(); } catch { /* proceed anyway */ }
                }

                // 2. Clear auth. The sync engine stops once the DEK is dropped.
                logout();

                // 3. Reset sync bookkeeping BEFORE wiping. On the next sign-in
                //    the server looks "ahead", so the empty local state can
                //    never be pushed back up as deletions.
                const record = await vaultDb.get();
                if (record) {
                    await vaultDb.put({
                        ...record,
                        lastSyncedVersion: 0,
                        lastSyncedAt: null,
                        lastSyncedConfig: {},
                        lastSyncedChatIds: [],
                        lastSyncedCounts: { chats: 0, projects: 0 },
                        tombstones: [],
                        lastSyncSignature: null,
                        updatedAt: new Date().toISOString(),
                    });
                }

                // 4. Wipe chats, projects, and synced settings from this device.
                //    The vault record and device key stay, so the next sign-in
                //    unlocks silently and pulls everything back from the server.
                await clearLocalData();

                // 5. Remember the signature of the now empty state, so the next
                //    sync is a clean download instead of a merge and push.
                try {
                    const signature = await computeLocalSignature();
                    const latest = await vaultDb.get();
                    if (latest) await vaultDb.put({ ...latest, lastSyncSignature: signature });
                } catch { /* cosmetic only */ }

                dismissReload();
            } else {
                logout();
            }
            onClose();
            onSignedOut?.();
        } catch (e) {
            setError(e.message || 'Something went wrong while signing out.');
            setWorking(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-aida-card rounded-xl shadow-2xl w-full max-w-sm border border-aida-border max-h-[90vh] overflow-y-auto my-auto">
                <div className="flex items-center justify-between p-4 border-b border-aida-border">
                    <h2 className="text-lg font-bold text-aida-dark flex items-center gap-2">
                        <FiLogOut className="w-5 h-5 text-aida-pink" />
                        Sign Out
                    </h2>
                    <button onClick={onClose} disabled={working} className="text-aida-text-muted hover:text-aida-dark">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-aida-text-muted">
                        Encrypted sync is on for this account.
                        {chatCount > 0 && ` You have ${chatCount} chat${chatCount === 1 ? '' : 's'} on this device.`}
                        {' '}Choose what happens to the local data when you sign out.
                    </p>

                    <div className="space-y-2">
                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            removeLocal
                                ? 'border-aida-pink bg-aida-pink/5'
                                : 'border-aida-border hover:bg-aida-light'
                        }`}>
                            <input
                                type="radio"
                                name="signout-local-data"
                                checked={removeLocal}
                                onChange={() => setRemoveLocal(true)}
                                className="mt-0.5 w-4 h-4 border-aida-border text-aida-pink focus:ring-aida-pink"
                            />
                            <span>
                                <span className="block text-sm font-medium text-aida-dark">
                                    Remove chats from this device
                                </span>
                                <span className="block text-xs text-aida-text-muted mt-0.5">
                                    Recommended, especially on shared devices.
                                </span>
                            </span>
                        </label>

                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            !removeLocal
                                ? 'border-aida-pink bg-aida-pink/5'
                                : 'border-aida-border hover:bg-aida-light'
                        }`}>
                            <input
                                type="radio"
                                name="signout-local-data"
                                checked={!removeLocal}
                                onChange={() => setRemoveLocal(false)}
                                className="mt-0.5 w-4 h-4 border-aida-border text-aida-pink focus:ring-aida-pink"
                            />
                            <span>
                                <span className="block text-sm font-medium text-aida-dark">
                                    Keep chats on this device
                                </span>
                                <span className="block text-xs text-aida-text-muted mt-0.5">
                                    They will be right here when you sign back in.
                                </span>
                            </span>
                        </label>
                    </div>

                    {removeLocal && (
                        <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                            <FiAlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>
                                Heads up: your chats and settings stay encrypted on the server
                                and will sync back the next time you sign in on this device.
                                Changes that have not synced yet will be lost.
                            </span>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-500">
                            <FiAlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {working && removeLocal && (
                        <div className="flex items-center gap-2 text-sm text-aida-text-muted">
                            <FiRefreshCw className="w-4 h-4 animate-spin text-aida-pink" />
                            Syncing, then removing local data...
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={working}
                            className="flex-1 px-4 py-2.5 border border-aida-border rounded-lg text-aida-dark font-medium hover:bg-aida-light disabled:opacity-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={working}
                            className="flex-1 px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                            {working ? 'Signing out...' : removeLocal ? 'Sign Out and Remove' : 'Sign Out'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SignOutModal;