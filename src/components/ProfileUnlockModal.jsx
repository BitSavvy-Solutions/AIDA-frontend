import React, { useState } from 'react';
import { FiX, FiLock, FiAlertCircle } from 'react-icons/fi';
import { useProfile } from '../contexts/ProfileContext';

const ProfileUnlockModal = ({ isOpen, onClose, profile }) => {
    const { unlockProfile } = useProfile();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen || !profile) return null;

    const handleUnlock = async () => {
        setLoading(true);
        setError('');
        try {
            await unlockProfile(profile.id, password);
            onClose();
        } catch (e) {
            setError(e.message === 'Incorrect password' ? 'Incorrect password' : 'Failed to unlock profile');
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
                        Unlock Profile
                    </h2>
                    <button onClick={onClose} className="text-aida-text-muted hover:text-aida-dark">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-aida-text-muted">
                        Enter the password for <strong className="text-aida-dark">{profile.name}</strong>
                    </p>

                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-3 py-2 border border-aida-border rounded-lg bg-aida-light text-aida-dark focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                        onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
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
                        {loading ? 'Unlocking...' : 'Unlock'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileUnlockModal;