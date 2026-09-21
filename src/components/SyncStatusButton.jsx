// src/components/SyncStatusButton.jsx
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    FiGlobe, FiLock, FiRefreshCw, FiCheck, FiAlertCircle,
    FiChevronDown, FiKey, FiX,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { usePkbSync } from '../contexts/PkbSyncContext';
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
    const {
        vaultExists, locked, syncStatus, syncNow, lockVault,
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

    const statusLower = (syncStatus || '').toLowerCase();
    const isSyncing = statusLower.includes('syncing') || statusLower.includes('uploading') || statusLower.includes('downloading');
    const isError = statusLower.includes('failed') || statusLower.includes('error');
    const isSuccess = statusLower.includes('complete');

    const StatusIcon = () => {
        if (locked) return <FiLock className="w-3.5 h-3.5 text-amber-500" />;
        if (isSyncing) return <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />;
        if (isError) return <FiAlertCircle className="w-3.5 h-3.5 text-red-600" />;
        if (isSuccess) return <FiCheck className="w-3.5 h-3.5 text-green-600" />;
        return <FiGlobe className="w-3.5 h-3.5 text-green-600" />;
    };

    const statusText = locked
        ? 'Locked. Enter your password to resume syncing.'
        : isSyncing
            ? 'Syncing...'
            : isError
                ? syncStatus
                : 'Encrypted sync is on.';

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
                                    <span className={`text-xs font-medium ${isError && !locked ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>
                                        {statusText}
                                    </span>
                                </div>
                            </div>

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
                                        disabled={isSyncing}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-40 transition-colors"
                                    >
                                        <FiRefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
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