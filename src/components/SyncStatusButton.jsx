// src/components/SyncStatusButton.jsx
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    FiGlobe, FiLock, FiRefreshCw, FiCheck, FiAlertCircle,
    FiChevronDown, FiKey, FiX, FiHardDrive,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useVault } from '../contexts/VaultContext';
import { useSync } from '../contexts/SyncContext';
import { vaultApi } from '../services/vaultApi';
import EnableSyncModal from './EnableSyncModal';
import UnlockSyncModal from './UnlockSyncModal';
import ForgotPasswordModal from './ForgotPasswordModal';
import DisableSyncModal from './DisableSyncModal';
import ChangePasswordModal from './ChangePasswordModal';

const relativeTime = (date) => {
    if (!date) return null;
    const secs = Math.round((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 5) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
};

const SyncStatusButton = () => {
    const { isAuthenticated } = useAuth();
    const { vault, dek, locked, loading, lock, notice, setNotice } = useVault();
    const {
        status, lastSyncedAt, syncError, needsReload, dismissReload, syncNow,
    } = useSync();

    const [panelOpen, setPanelOpen] = useState(false);
    const [enableOpen, setEnableOpen] = useState(false);
    const [unlockOpen, setUnlockOpen] = useState(false);
    const [forgotOpen, setForgotOpen] = useState(false);
    const [disableOpen, setDisableOpen] = useState(false);
    const [changeOpen, setChangeOpen] = useState(false);
    const [usage, setUsage] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!loading && vault && !dek) setUnlockOpen(true);
    }, [vault, dek, loading]);

    useEffect(() => {
        if (dek) setUnlockOpen(false);
    }, [dek]);

    useEffect(() => {
        if (!panelOpen) return;
        const handler = (e) => {
            if (!menuRef.current?.contains(e.target)) setPanelOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [panelOpen]);

    useEffect(() => {
        if (panelOpen && vault?.serverVaultId) {
            vaultApi.getUsage().then(setUsage).catch(() => {});
        }
    }, [panelOpen, vault]);

    if (!isAuthenticated || loading) return null;

    const StatusIcon = () => {
        if (locked) return <FiLock className="w-3.5 h-3.5 text-amber-500" />;
        if (status === 'syncing') return <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />;
        if (status === 'success') return <FiCheck className="w-3.5 h-3.5 text-green-600" />;
        if (status === 'error') return <FiAlertCircle className="w-3.5 h-3.5 text-red-600" />;
        return <FiGlobe className="w-3.5 h-3.5 text-green-600" />;
    };

    const statusText = locked
        ? 'Locked. Enter your password to resume syncing.'
        : status === 'syncing'
            ? 'Syncing...'
            : status === 'error'
                ? (syncError || 'Sync error')
                : 'Encrypted sync is on.';

    const usagePercent = usage
        ? Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100)
        : 0;

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

            {notice && (
                <div className="fixed bottom-6 left-6 right-6 md:right-auto z-[3000] max-w-full md:max-w-sm">
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <FiAlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-700 dark:text-gray-200 flex-1">{notice}</p>
                        <button onClick={() => setNotice(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <FiX className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {needsReload && (
                <div className="fixed bottom-6 left-6 right-6 md:right-auto z-[3000] max-w-full md:max-w-sm">
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <FiRefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-700 dark:text-gray-200 flex-1">
                            Settings were updated from another device. Reload to apply them.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="text-xs font-semibold text-aida-pink hover:underline flex-shrink-0"
                        >
                            Reload
                        </button>
                        <button onClick={dismissReload} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <FiX className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );

    return (
        <>
            {!vault ? (
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
                        onClick={() => setPanelOpen(p => !p)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 text-gray-600 bg-gray-100 border-gray-200 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
                    >
                        <StatusIcon />
                        <span className="hidden md:inline">{locked ? 'Sync locked' : 'Sync'}</span>
                        <FiChevronDown className="w-3 h-3" />
                    </button>

                    {panelOpen && (
                        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl shadow-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                                <div className="flex items-center gap-2">
                                    <StatusIcon />
                                    <span className={`text-xs font-medium ${status === 'error' && !locked ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>
                                        {statusText}
                                    </span>
                                </div>
                                {lastSyncedAt && !locked && (
                                    <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 ml-6">
                                        Last synced: {relativeTime(lastSyncedAt)}
                                    </p>
                                )}
                            </div>

                            {usage && (
                                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <FiHardDrive className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
                                            {(usage.usedBytes / (1024 * 1024)).toFixed(1)} MB of {(usage.quotaBytes / (1024 * 1024)).toFixed(0)} MB used
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                                        <div
                                            className={`h-1.5 rounded-full transition-all ${
                                                usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-aida-pink'
                                            }`}
                                            style={{ width: `${usagePercent}%` }}
                                        />
                                    </div>
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
                                        disabled={status === 'syncing'}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-40 transition-colors"
                                    >
                                        <FiRefreshCw className={`w-4 h-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
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
                                        onClick={() => { lock(); setPanelOpen(false); }}
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