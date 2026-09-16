import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiKey, FiAlertCircle, FiAlertTriangle, FiEye, FiEyeOff } from 'react-icons/fi';
import { useVault } from '../contexts/VaultContext';

const ForgotPasswordModal = ({ isOpen, onClose }) => {
    const { resetWithRecovery, resetBackup } = useVault();
    const [step, setStep] = useState('reset'); // reset | done | lost | lostDone
    const [recoveryKey, setRecoveryKeyInput] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleReset = async () => {
        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await resetWithRecovery(recoveryKey.trim(), newPassword);
            setStep('done');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetBackup = async () => {
        setLoading(true);
        setError('');
        try {
            await resetBackup();
            setStep('lostDone');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep('reset');
        setRecoveryKeyInput('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-aida-card rounded-xl shadow-2xl w-full max-w-sm border border-aida-border max-h-[90vh] overflow-y-auto my-auto">
                <div className="flex items-center justify-between p-4 border-b border-aida-border">
                    <h2 className="text-lg font-bold text-aida-dark flex items-center gap-2">
                        <FiKey className="w-5 h-5 text-aida-pink" />
                        Recover Access
                    </h2>
                    <button onClick={reset} className="text-aida-text-muted hover:text-aida-dark">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {step === 'reset' && (
                        <>
                            <p className="text-sm text-aida-text-muted">
                                Enter your recovery key and choose a new password.
                            </p>

                            <input
                                type="text"
                                value={recoveryKey}
                                onChange={(e) => setRecoveryKeyInput(e.target.value)}
                                placeholder="XXXX-XXXX-XXXX-..."
                                className="w-full px-3 py-2 border border-aida-border rounded-lg bg-aida-light text-aida-dark font-mono text-sm focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                            />

                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="New password (at least 8 characters)"
                                    className="w-full px-3 py-2 pr-10 border border-aida-border rounded-lg bg-aida-light text-aida-dark focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(p => !p)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-aida-text-muted hover:text-aida-dark"
                                >
                                    {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                </button>
                            </div>

                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                className="w-full px-3 py-2 border border-aida-border rounded-lg bg-aida-light text-aida-dark focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                            />

                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-500">
                                    <FiAlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleReset}
                                disabled={!recoveryKey || !newPassword || loading}
                                className="w-full px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            >
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>

                            <button
                                onClick={() => { setError(''); setStep('lost'); }}
                                className="w-full text-center text-xs text-aida-text-muted hover:text-aida-dark hover:underline"
                            >
                                Lost your recovery key too?
                            </button>
                        </>
                    )}

                    {step === 'done' && (
                        <>
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                <p className="text-sm text-green-700 dark:text-green-300">
                                    Password reset. Sync is unlocked and will resume automatically.
                                </p>
                            </div>
                            <button
                                onClick={reset}
                                className="w-full px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                            >
                                Done
                            </button>
                        </>
                    )}

                    {step === 'lost' && (
                        <>
                            <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                                <FiAlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>
                                    Without the password and the recovery key, the encrypted server backup
                                    can never be read again. You can delete it and start fresh.
                                </span>
                            </div>
                            <ul className="space-y-1.5 list-disc pl-5 text-xs text-aida-text-muted">
                                <li>Your local data on this device is kept exactly as it is.</li>
                                <li>The encrypted server backup is permanently deleted.</li>
                                <li>Anything that exists only on the server or on other devices is lost.</li>
                                <li>You can enable encrypted sync again at any time.</li>
                            </ul>

                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-500">
                                    <FiAlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setError(''); setStep('reset'); }}
                                    className="flex-1 px-4 py-2.5 border border-aida-border rounded-lg text-aida-dark font-medium hover:bg-aida-light transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleResetBackup}
                                    disabled={loading}
                                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                    {loading ? 'Deleting...' : 'Delete Backup'}
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'lostDone' && (
                        <>
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                <p className="text-sm text-green-700 dark:text-green-300">
                                    The server backup was deleted. Your local data on this device is
                                    unchanged. You can set up encrypted sync again whenever you like.
                                </p>
                            </div>
                            <button
                                onClick={reset}
                                className="w-full px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                            >
                                Done
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ForgotPasswordModal;