// src/components/ProfileSwitcher.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
    FiUser, FiLock, FiPlus, FiRefreshCw, FiCheck,
    FiAlertCircle, FiChevronDown, FiLogIn, FiHardDrive, FiUploadCloud
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { useProfileSync } from '../contexts/ProfileSyncContext';
import { useProfileLauncher } from '../contexts/ProfileLauncherContext';
import { countPendingItems } from '../services/snapshot';
import ProfileUnlockModal from './ProfileUnlockModal';

const SyncBadge = ({ profile, isActive, refreshKey, onBadgeClick }) => {
    const [info, setInfo] = useState(null);

    useEffect(() => {
        let alive = true;
        if (!profile.syncEnabled) {
            setInfo({ localOnly: true });
            return;
        }
        if (isActive) {
            countPendingItems(profile).then(r => { if (alive) setInfo(r); });
        } else {
            setInfo(null);
        }
        return () => { alive = false; };
    }, [profile, isActive, refreshKey]);

    if (!profile.syncEnabled) {
        return (
            <span className="flex items-center gap-1 text-[10px] text-gray-400" title="Local only, not synced">
                <FiHardDrive className="w-3 h-3" /> local
            </span>
        );
    }

    const serverChats = profile.lastSyncedCounts?.chats
        ?? (profile.lastSyncedChatIds?.length || 0);
    const version = profile.lastSyncedVersion ?? 0;

    if (!isActive) {
        return (
            <span
                className="flex items-center gap-1 text-[10px] text-green-600"
                title={`On server: ${serverChats} chat(s), version ${version}`}
            >
                <FiCheck className="w-3 h-3" />
                {serverChats}
            </span>
        );
    }

    if (!info) return null;

    const pending = Math.max(0, info.local - info.synced);
    const clean = !info.dirty && pending === 0;
    const title = clean
        ? `All synced. Server has ${serverChats} chat(s) (v${version}).`
        : `${pending} item(s) pending upload. Local: ${info.local}, synced: ${info.synced}, server: ${serverChats}. Click to sync now.`;

    return (
        <span
            onClick={onBadgeClick}
            className={`flex items-center gap-1 text-[10px] ${clean ? 'text-green-600' : 'text-amber-500 cursor-pointer'}`}
            title={title}
        >
            {clean ? <FiCheck className="w-3 h-3" /> : <FiUploadCloud className="w-3 h-3" />}
            {info.synced}/{info.local}
        </span>
    );
};

const ProfileSwitcher = () => {
    const { isAuthenticated } = useAuth();
    const { profiles, activeProfile, dek, lockProfile, loading } = useProfile();
    const { status, lastSyncedAt, syncError, syncNow, switchState } = useProfileSync();
    const { requestCreateProfile } = useProfileLauncher();

    const [menuOpen, setMenuOpen] = useState(false);
    const [unlockProfileTarget, setUnlockProfileTarget] = useState(null);
    const menuRef = useRef(null);

    // Only prompt for unlock once the profile context has finished loading.
    // After a switch/reload, the password handoff auto-unlock runs during
    // loading; without this guard the modal would flash open and then sit
    // on top of an already-unlocked profile.
    useEffect(() => {
        if (activeProfile && !dek && !loading) {
            setUnlockProfileTarget(activeProfile);
        }
    }, [activeProfile, dek, loading]);

    // If the modal is open for the active profile and it becomes unlocked,
    // close it automatically.
    useEffect(() => {
        if (dek && unlockProfileTarget && unlockProfileTarget.id === activeProfile?.id) {
            setUnlockProfileTarget(null);
        }
    }, [dek, activeProfile, unlockProfileTarget]);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e) => {
            if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    const StatusIcon = () => {
        if (activeProfile && !dek) return <FiLock className="w-3.5 h-3.5 text-amber-500" />;
        if (status === 'syncing') return <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />;
        if (status === 'success') return <FiCheck className="w-3.5 h-3.5 text-green-600" />;
        if (status === 'error') return <FiAlertCircle className="w-3.5 h-3.5 text-red-600" />;
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

    const refreshKey = `${status}-${lastSyncedAt ? lastSyncedAt.getTime?.() ?? lastSyncedAt : ''}`;

    const percent = switchState?.total
        ? Math.min(100, Math.round(((switchState.done || 0) / switchState.total) * 100))
        : null;

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
                    <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl shadow-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                            <div className="flex items-center gap-2">
                                <FiUser className="w-4 h-4 text-aida-pink flex-shrink-0" />
                                <span className="font-semibold text-gray-800 dark:text-gray-100 text-xs">
                                    {activeProfile
                                        ? (dek ? `Active: ${activeProfile.name}` : `Locked: ${activeProfile.name}`)
                                        : 'Local Storage'}
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
                                        if (!dek) setUnlockProfileTarget(p);
                                    } else {
                                        setUnlockProfileTarget(p);
                                    }
                                    setMenuOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <FiLock className="w-4 h-4 flex-shrink-0" />
                                <span className="flex-1 truncate">{p.name}</span>
                                <SyncBadge
                                    profile={p}
                                    isActive={p.id === activeProfile?.id}
                                    refreshKey={refreshKey}
                                    onBadgeClick={(e) => {
                                        e.stopPropagation();
                                        if (p.id === activeProfile?.id && dek) syncNow();
                                    }}
                                />
                                {p.id === activeProfile?.id && dek && (
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

                        {activeProfile && dek && (
                            <>
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
                                <button
                                    type="button"
                                    onClick={() => {
                                        lockProfile();
                                        setMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                    <FiLock className="w-4 h-4" />
                                    Lock Profile
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <ProfileUnlockModal
                isOpen={Boolean(unlockProfileTarget)}
                onClose={() => setUnlockProfileTarget(null)}
                profile={unlockProfileTarget}
            />

            {switchState && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-72 p-5">
                        <div className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                            <FiRefreshCw className="w-4 h-4 animate-spin text-aida-pink" />
                            <span>{switchState.message}</span>
                        </div>
                        <div className="mt-3 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-aida-pink rounded-full transition-all duration-300"
                                style={{ width: percent != null ? `${percent}%` : '40%' }}
                            />
                        </div>
                        {percent != null && (
                            <p className="mt-1.5 text-[10px] text-gray-500">
                                {switchState.done}/{switchState.total} synced
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default ProfileSwitcher;