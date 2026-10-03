// src/components/SyncStatusButton.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    FiGlobe, FiLock, FiRefreshCw, FiCheck, FiAlertCircle,
    FiChevronDown, FiKey,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { usePkbSync } from '../contexts/PkbSyncContext';
import EnableSyncModal from './EnableSyncModal';
import UnlockSyncModal from './UnlockSyncModal';
import ForgotPasswordModal from './ForgotPasswordModal';
import DisableSyncModal from './DisableSyncModal';
import ChangePasswordModal from './ChangePasswordModal';

const SyncStatusButton = () => {
    const { isAuthenticated } = useAuth();
    const {
        vaultExists, locked, syncStatus, syncProgress, syncNow, lockVault,
    } = usePkbSync();

    const [panelOpen, setPanelOpen] = useState(false);
    const [enableOpen, setEnableOpen] = useState(false);
    const [unlockOpen, setUnlockOpen] = useState(false);
    const [forgotOpen, setForgotOpen] = useState(false);
    const [disableOpen, setDisableOpen] = useState(false);
    const [changeOpen, setChangeOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!panelOpen) return;
        const handler = (e) => {
            if (!menuRef.current?.contains(e.target)) setPanelOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [panelOpen]);

    useEffect(() => {
        const handler = () => {
            if (!vaultExists) {
                setEnableOpen(true);
            } else if (locked) {
                setUnlockOpen(true);
            }
        };
        window.addEventListener('aida:open-enable-sync', handler);
        return () => window.removeEventListener('aida:open-enable-sync', handler);
    }, [vaultExists, locked]);

    if (!isAuthenticated) return null;

    const plural = (n) => (n === 1 ? '' : 's');

    const display = useMemo(() => {
        if (locked) {
            return {
                icon: FiLock,
                spin: false,
                color: 'text-amber-500',
                label: 'Locked',
                title: 'Encrypted sync is locked. Click to unlock.',
            };
        }

        const p = syncProgress;
        if (p && p.phase !== 'idle') {
            if (p.phase === 'preparing') {
                return {
                    icon: FiRefreshCw,
                    spin: true,
                    label: 'Syncing...',
                    title: `${p.totalUploads || 0} change${plural(p.totalUploads || 0)} to upload, ${p.totalDownloads || 0} remote change${plural(p.totalDownloads || 0)} to download`,
                };
            }

            if (p.phase === 'uploading') {
                const pending = Math.max(
                    0,
                    (p.totalDownloads || 0) - (p.completedDownloads || 0)
                );
                return {
                    icon: FiRefreshCw,
                    spin: true,
                    label: `${p.completedUploads || 0}/${p.totalUploads || 0}`,
                    title: `Uploading ${p.completedUploads || 0} of ${p.totalUploads || 0}${pending ? ` - ${pending} download${plural(pending)} pending` : ''}`,
                };
            }

            if (p.phase === 'downloading') {
                return {
                    icon: FiRefreshCw,
                    spin: true,
                    label: `${p.completedDownloads || 0}/${p.totalDownloads || 0}`,
                    title: `Downloading ${p.completedDownloads || 0} of ${p.totalDownloads || 0}`,
                };
            }

            if (p.phase === 'complete') {
                const items = p.syncedItems || 0;
                return {
                    icon: FiCheck,
                    spin: false,
                    color: 'text-green-600',
                    label: `${items} synced`,
                    title: `${items} chat${plural(items)} synced`,
                };
            }

            if (p.phase === 'error') {
                return {
                    icon: FiAlertCircle,
                    spin: false,
                    color: 'text-red-600',
                    label: 'Error',
                    title: p.message || syncStatus || 'Sync failed',
                };
            }
        }

        const statusLower = (syncStatus || '').toLowerCase();
        const isSyncing =
            statusLower.includes('syncing') ||
            statusLower.includes('uploading') ||
            statusLower.includes('downloading');
        const isError =
            statusLower.includes('failed') || statusLower.includes('error');
        const isSuccess = statusLower.includes('complete');

        if (isSyncing) {
            return {
                icon: FiRefreshCw,
                spin: true,
                label: 'Syncing...',
                title: syncStatus,
            };
        }

        if (isError) {
            return {
                icon: FiAlertCircle,
                spin: false,
                color: 'text-red-600',
                label: 'Error',
                title: syncStatus,
            };
        }

        if (isSuccess) {
            return {
                icon: FiCheck,
                spin: false,
                color: 'text-green-600',
                label: 'Synced',
                title: syncStatus,
            };
        }

        return {
            icon: FiGlobe,
            spin: false,
            color: 'text-green-600',
            label: 'Sync',
            title: 'Encrypted sync is on. Click for options.',
        };
    }, [locked, syncProgress, syncStatus]);

    const progressDetail = useMemo(() => {
        if (!syncProgress || syncProgress.phase === 'idle') return null;

        const p = syncProgress;
        const s = (n) => (n === 1 ? '' : 's');

        if (p.phase === 'preparing') {
            return `Found ${p.totalUploads || 0} local change${s(p.totalUploads || 0)} and ${p.totalDownloads || 0} remote change${s(p.totalDownloads || 0)}.`;
        }

        if (p.phase === 'uploading') {
            const pending = Math.max(
                0,
                (p.totalDownloads || 0) - (p.completedDownloads || 0)
            );
            return `Uploading ${p.completedUploads || 0} of ${p.totalUploads || 0}${pending ? ` (${pending} download${s(pending)} pending)` : ''}.`;
        }

        if (p.phase === 'downloading') {
            return `Downloading ${p.completedDownloads || 0} of ${p.totalDownloads || 0}.`;
        }

        if (p.phase === 'complete') {
            const items = p.syncedItems || 0;
            return `${items} chat${s(items)} synced.`;
        }

        if (p.phase === 'error') {
            return p.message || 'Sync failed.';
        }

        return null;
    }, [syncProgress]);

    const StatusIcon = () => {
        const Icon = display.icon;
        return (
            <Icon
                className={`w-3.5 h-3.5 ${display.spin ? 'animate-spin' : ''} ${display.color || ''}`}
            />
        );
    };

    const overlays = (
        <>
            <EnableSyncModal isOpen={enableOpen} onClose={() => setEnableOpen(false)} />
            <UnlockSyncModal
                isOpen={unlockOpen}
                onClose={() => setUnlockOpen(false)}
                onForgotPassword={() => { setUnlockOpen(false); setForgotOpen(true); }}
            />
            <ForgotPasswordModal isOpen={forgotOpen} onClose={() => setForgotOpen(false)} />
            <DisableSyncModal isOpen={disableOpen} onClose={() => setDisableOpen(false)} />
            <ChangePasswordModal isOpen={changeOpen} onClose={() => setChangeOpen(false)} />
        </>
    );

    return (
        <>
            {!vaultExists ? (
                <button
                    type="button"
                    onClick={() => setEnableOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 text-gray-600 bg-gray-100 border-gray-200 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
                    title="Enable encrypted sync across devices"
                >
                    <FiGlobe className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Enable sync</span>
                </button>
            ) : (
                <div className="relative" ref={menuRef}>
                    <button
                        type="button"
                        onClick={() => setPanelOpen((p) => !p)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 text-gray-600 bg-gray-100 border-gray-200 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
                        title={display.title}
                    >
                        <StatusIcon />
                        <span className="hidden md:inline">{display.label}</span>
                        <FiChevronDown className="w-3 h-3" />
                    </button>

                    {panelOpen && (
                        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl shadow-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                                <div className="flex items-center gap-2">
                                    <StatusIcon />
                                    <span className={`text-xs font-medium ${display.color || 'text-gray-800 dark:text-gray-100'}`}>
                                        {display.title}
                                    </span>
                                </div>
                            </div>

                            {progressDetail && (
                                <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                    {progressDetail}
                                </div>
                            )}

                            {locked ? (
                                <button
                                    type="button"
                                    onClick={() => { setUnlockOpen(true); setPanelOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-aida-pink hover:bg-aida-pink/10 transition-colors"
                                >
                                    <FiLock className="w-4 h-4" />
                                    Unlock Sync
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => { syncNow(); setPanelOpen(false); }}
                                        disabled={display.spin}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-40 transition-colors"
                                    >
                                        <FiRefreshCw className={`w-4 h-4 ${display.spin ? 'animate-spin' : ''}`} />
                                        Sync Now
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setChangeOpen(true); setPanelOpen(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                                    >
                                        <FiKey className="w-4 h-4" />
                                        Change Password
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { lockVault(); setPanelOpen(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                                    >
                                        <FiLock className="w-4 h-4" />
                                        Lock Sync
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setDisableOpen(true); setPanelOpen(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-gray-100 dark:border-gray-700 transition-colors"
                                    >
                                        <FiAlertCircle className="w-4 h-4" />
                                        Disable Sync and Delete Backup
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {createPortal(overlays, document.body)}
        </>
    );
};

export default SyncStatusButton;