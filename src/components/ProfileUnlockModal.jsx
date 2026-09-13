import React, { useState } from 'react';
import { FiX, FiLock, FiAlertCircle, FiAlertTriangle } from 'react-icons/fi';
import { useProfile } from '../contexts/ProfileContext';
import { useProfileSync } from '../contexts/ProfileSyncContext';

const ProfileUnlockModal = ({ isOpen, onClose, profile }) => {
    const { activeProfile, unlockProfile } = useProfile();
    const { switchToProfile } = useProfileSync();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen || !profile) return null;

    const isSameProfile = activeProfile && activeProfile.id === profile.id;
    const switchingAwayFromLocal =
        activeProfile && activeProfile.id !== profile.id && !activeProfile.syncEnabled;

    const handleUnlock = async () => {
        setLoading(true);
        setError('');
        try {
            if (isSameProfile) {
                // Re-unlock after a page reload. No wipe, no reload.
                await unlockProfile(profile.id, password);
            } else {
                await switchToProfile(profile.id, password, profile.name);
            }
            setPassword('');
            onClose();
        } catch (e) {
            setError(
                e.message === 'Incorrect password'
                    ? 'Incorrect password'
                    : (e.message || 'Failed to switch profile')
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
                        {isSameProfile ? 'Unlock Profile' : 'Switch Profile'}
                    </h2>
                    <button onClick={onClose} className="text-aida-text-muted hover:text-aida-dark">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {isSameProfile ? (
                        <p className="text-sm text-aida-text-muted">
                            <strong className="text-aida-dark">{profile.name}</strong> is locked. Enter
                            the password to continue syncing on this device.
                        </p>
                    ) : (
                        <p className="text-sm text-aida-text-muted">
                            Switching to <strong className="text-aida-dark">{profile.name}</strong>
                        </p>
                    )}

                    {switchingAwayFromLocal && (
                        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
                            <FiAlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>
                                "{activeProfile.name}" is not synced. Its local data will be removed
                                from this browser on switch.
                            </span>
                        </div>
                    )}

                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-3 py-2 border border-aida-border rounded-lg bg-aida-light text-aida-dark focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                        onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                        autoFocus
                    />

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
                        {loading
                            ? 'Unlocking...'
                            : isSameProfile
                                ? 'Unlock'
                                : 'Unlock & Switch'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileUnlockModal;