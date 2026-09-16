import React, { useState } from 'react';
import { FiX, FiLock, FiAlertCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { useVault } from '../contexts/VaultContext';

const UnlockSyncModal = ({ isOpen, onClose, onForgotPassword }) => {
    const { unlock } = useVault();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleUnlock = async () => {
        setLoading(true);
        setError('');
        try {
            await unlock(password);
            setPassword('');
            onClose();
        } catch (e) {
            setError(
                e.message === 'Incorrect password'
                    ? 'Incorrect password'
                    : (e.message || 'Failed to unlock')
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-aida-card rounded-xl shadow-2xl w-full max-w-sm border border-aida-border">
                <div className="flex items-center justify-between p-4 border-b border-aida-border">
                    <h2 className="text-lg font-bold text-aida-dark flex items-center gap-2">
                        <FiLock className="w-5 h-5 text-aida-pink" />
                        Unlock Encrypted Sync
                    </h2>
                    <button onClick={onClose} className="text-aida-text-muted hover:text-aida-dark">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-aida-text-muted">
                        Syncing is paused. Enter your password to resume. Your local data stays
                        available either way.
                    </p>

                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full px-3 py-2 pr-10 border border-aida-border rounded-lg bg-aida-light text-aida-dark focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
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
                        onClick={handleUnlock}
                        disabled={!password || loading}
                        className="w-full px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                        {loading ? 'Unlocking...' : 'Unlock'}
                    </button>

                    <button
                        onClick={onForgotPassword}
                        className="w-full text-center text-xs text-aida-pink hover:underline"
                    >
                        Forgot password?
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UnlockSyncModal;