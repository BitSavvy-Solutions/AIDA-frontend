import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiLogOut, FiAlertTriangle, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { usePkbSync } from '../contexts/PkbSyncContext';
import { db } from '../services/pkbSync';

const SignOutModal = ({ isOpen, onClose, onSignedOut }) => {
    const { removeLocalData } = usePkbSync();

    const [removeLocal, setRemoveLocal] = useState(true);
    const [chatCount, setChatCount] = useState(null);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setRemoveLocal(true);
        setError('');
        setWorking(false);
        let alive = true;

        db.docs
            .filter((doc) => doc.kind === 'note' && !doc.deleted)
            .count()
            .then((count) => { if (alive) setChatCount(count); })
            .catch(() => {});

        return () => { alive = false; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setWorking(true);
        setError('');
        try {
            if (removeLocal) {
                await removeLocalData();
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