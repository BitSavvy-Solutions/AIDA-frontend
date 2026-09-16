import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiKey, FiAlertCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { useVault } from '../contexts/VaultContext';

const ChangePasswordModal = ({ isOpen, onClose }) => {
    const { changePassword } = useVault();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    if (!isOpen) return null;

    const handleChange = async () => {
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
            await changePassword(currentPassword, newPassword);
            setDone(true);
        } catch (e) {
            setError(
                e.message === 'Incorrect password'
                    ? 'Current password is incorrect'
                    : (e.message || 'Failed to change password')
            );
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        setDone(false);
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-aida-card rounded-xl shadow-2xl w-full max-w-sm border border-aida-border max-h-[90vh] overflow-y-auto my-auto">
                <div className="flex items-center justify-between p-4 border-b border-aida-border">
                    <h2 className="text-lg font-bold text-aida-dark flex items-center gap-2">
                        <FiKey className="w-5 h-5 text-aida-pink" />
                        Change Password
                    </h2>
                    <button onClick={reset} className="text-aida-text-muted hover:text-aida-dark">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {done ? (
                        <>
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                <p className="text-sm text-green-700 dark:text-green-300">
                                    Password changed. Other devices will ask for the new password on their
                                    next unlock.
                                </p>
                            </div>
                            <button
                                onClick={reset}
                                className="w-full px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                            >
                                Done
                            </button>
                        </>
                    ) : (
                        <>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Current password"
                                className="w-full px-3 py-2 border border-aida-border rounded-lg bg-aida-light text-aida-dark focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                                autoFocus
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
                                onClick={handleChange}
                                disabled={!currentPassword || !newPassword || loading}
                                className="w-full px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            >
                                {loading ? 'Changing...' : 'Change Password'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ChangePasswordModal;