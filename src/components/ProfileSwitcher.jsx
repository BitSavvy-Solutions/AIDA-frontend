// src/components/ProfileSwitcher.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
    FiUser, FiLock, FiPlus, FiRefreshCw, FiCheck,
    FiAlertCircle, FiChevronDown, FiLogIn
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { useProfileSync } from '../contexts/ProfileSyncContext';
import { useProfileLauncher } from '../contexts/ProfileLauncherContext';
import ProfileUnlockModal from './ProfileUnlockModal';

const ProfileSwitcher = () => {
    const { isAuthenticated } = useAuth();
    const { profiles, activeProfile, lockProfile } = useProfile();
    const { status, lastSyncedAt, syncError, syncNow } = useProfileSync();
    const { requestCreateProfile } = useProfileLauncher();

    const [menuOpen, setMenuOpen] = useState(false);
    const [unlockProfile, setUnlockProfile] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e) => {
            if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    const StatusIcon = () => {
        if (status === 'syncing') return <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />;
        if (status === 'success') return <FiCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />;
        if (status === 'error') return <FiAlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />;
        return <FiUser className="w-3.5 h-3.5" />;
    };

    const relativeTime = (date) => {
        if (!date) return null;
        const secs = Math.round((Date.now() - new Date(date).getTime()) / 1000);
        if (secs < 5) return 'just now';
        if (secs < 60) return `${secs}s ago`;
        if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
        return `${Math.floor(secs / 3600)}h ago`;
    };

    return (
        <>
            <div className="relative" ref={menuRef}>
                <button
                    type="button"
                    onClick={() => setMenuOpen((p) => !p)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 text-gray-600 bg-gray-100 border-gray-200 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
                >
                    <StatusIcon />
                    <span className="hidden md:inline">
                        {activeProfile ? activeProfile.name : 'Local'}
                    </span>
                    <FiChevronDown className="w-3 h-3" />
                </button>

                {menuOpen && (
                    <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl shadow-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                            <div className="flex items-center gap-2">
                                <FiUser className="w-4 h-4 text-aida-pink flex-shrink-0" />
                                <span className="font-semibold text-gray-800 dark:text-gray-100 text-xs">
                                    {activeProfile ? `Active: ${activeProfile.name}` : 'Local Storage'}
                                </span>
                            </div>
                            {activeProfile && lastSyncedAt && (
                                <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 ml-6">
                                    Last synced: {relativeTime(lastSyncedAt)}
                                </p>
                            )}
                            {syncError && (
                                <p className="mt-1 text-[10px] text-red-500 dark:text-red-400 ml-6 truncate" title={syncError}>
                                    {syncError}
                                </p>
                            )}
                        </div>

                        {profiles.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                    if (p.id === activeProfile?.id) {
                                        lockProfile();
                                    } else {
                                        setUnlockProfile(p);
                                    }
                                    setMenuOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <FiLock className="w-4 h-4" />
                                <span className="flex-1">{p.name}</span>
                                {p.id === activeProfile?.id && (
                                    <FiCheck className="w-4 h-4 text-green-600" />
                                )}
                            </button>
                        ))}

                        {isAuthenticated ? (
                            <button
                                type="button"
                                onClick={() => {
                                    requestCreateProfile();
                                    setMenuOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-aida-pink hover:bg-aida-pink/10 border-t border-gray-100 dark:border-gray-700 transition-colors"
                            >
                                <FiPlus className="w-4 h-4" />
                                Create Profile
                            </button>
                        ) : (
                            <div className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                                <FiLogIn className="w-3.5 h-3.5" />
                                Sign in to create encrypted profiles
                            </div>
                        )}

                        {activeProfile && (
                            <button
                                type="button"
                                onClick={() => {
                                    syncNow();
                                    setMenuOpen(false);
                                }}
                                disabled={status === 'syncing'}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-40 transition-colors"
                            >
                                <FiRefreshCw className={`w-4 h-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
                                Sync Now
                            </button>
                        )}
                    </div>
                )}
            </div>

            <ProfileUnlockModal
                isOpen={Boolean(unlockProfile)}
                onClose={() => setUnlockProfile(null)}
                profile={unlockProfile}
            />
        </>
    );
};

export default ProfileSwitcher;