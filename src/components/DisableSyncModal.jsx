// src/components/DisableSyncModal.jsx
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiAlertTriangle, FiAlertCircle, FiRefreshCw, FiEye, FiEyeOff } from 'react-icons/fi';
import { usePkbSync } from '../contexts/PkbSyncContext';
import { unlockPkbVault } from '../services/pkbSync'; // used only for password verification
import { useAuth } from '../contexts/AuthContext';

const DisableSyncModal = ({ isOpen, onClose }) => {
    const { disableSync } = usePkbSync();
    const { apiToken } = useAuth();

    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [disabling, setDisabling] = useState(false);
    const [verified, setVerified] = useState(false); // true after password is confirmed

    if (!isOpen) return null;

    const handleVerifyPassword = async () => {
        setError('');
        try {
            // Verify the password without unlocking the vault in context
            await unlockPkbVault(apiToken, password);
            setVerified(true);
        } catch (e) {
            setError('Incorrect password.');
        }
    };

    const handleDisable = async () => {
        setError('');
        setDisabling(true);
        try {
            await disableSync();
            onClose();
        } catch (e) {
            setError(e.message || 'Failed to disable sync. Nothing was deleted.');
        } finally {
            setDisabling(false);
        }
    };

    const reset = () => {
        setPassword('');
        setShowPassword(false);
        setError('');
        setVerified(false);
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-aida-card rounded-xl shadow-2xl w-full max-w-sm border border-aida-border max-h-[90vh] overflow-y-auto my-auto">
                <div className="flex items-center justify-between p-4 border-b border-aida-border">
                    <h2 className="text-lg font-bold text-aida-dark flex items-center gap-2">
                        <FiAlertTriangle className="w-5 h-5 text-red-500" />
                        Disable Encrypted Sync
                    </h2>
                    <button onClick={reset} disabled={disabling} className="text-aida-text-muted hover:text-aida-dark">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {!verified ? (
                        <>
                            <p className="text-sm text-aida-text-muted">
                                Enter your vault password to confirm deletion. This action cannot be undone.
                            </p>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Vault password"
                                    className="w-full px-3 py-2 pr-10 border border-aida-border rounded-lg bg-aida-light text-aida-dark focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(p => !p)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-aida-text-muted hover:text-aida-dark"
                                >
                                    {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                </button>
                            </div>
                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-500">
                                    <FiAlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}
                            <button
                                onClick={handleVerifyPassword}
                                disabled={!password}
                                className="w-full px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            >
                                Verify Password
                            </button>
                        </>
                    ) : (
                        <>
                            <ul className="space-y-2 list-disc pl-5 text-sm text-aida-text-muted">
                                <li>Anything on the server that is missing on this device will be downloaded first.</li>
                                <li>The encrypted server backup will then be <strong className="text-aida-dark">permanently deleted</strong>.</li>
                                <li>Other devices will show that the backup no longer exists and will stop syncing.</li>
                                <li>Your data on this device stays exactly as it is.</li>
                                <li>You can re-enable sync at any time with a new password.</li>
                            </ul>

                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-500">
                                    <FiAlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            {disabling && (
                                <div className="flex items-center gap-2 text-sm text-aida-text-muted">
                                    <FiRefreshCw className="w-4 h-4 animate-spin text-aida-pink" />
                                    Downloading, then deleting the backup...
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={reset}
                                    disabled={disabling}
                                    className="flex-1 px-4 py-2.5 border border-aida-border rounded-lg text-aida-dark font-medium hover:bg-aida-light disabled:opacity-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDisable}
                                    disabled={disabling}
                                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                    {disabling ? 'Working...' : 'Disable and Delete'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DisableSyncModal;