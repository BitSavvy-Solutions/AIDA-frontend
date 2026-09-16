import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiAlertTriangle, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { useVault } from '../contexts/VaultContext';
import { useSync } from '../contexts/SyncContext';

const DisableSyncModal = ({ isOpen, onClose }) => {
    const { setNotice } = useVault();
    const { disableSync, disabling } = useSync();
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleDisable = async () => {
        setError('');
        try {
            await disableSync();
            setNotice('Encrypted sync is off. The server backup was deleted. Your data stays on this device.');
            onClose();
        } catch (e) {
            setError(e.message || 'Failed to disable sync. Nothing was deleted.');
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-aida-card rounded-xl shadow-2xl w-full max-w-sm border border-aida-border max-h-[90vh] overflow-y-auto my-auto">
                <div className="flex items-center justify-between p-4 border-b border-aida-border">
                    <h2 className="text-lg font-bold text-aida-dark flex items-center gap-2">
                        <FiAlertTriangle className="w-5 h-5 text-red-500" />
                        Disable Encrypted Sync
                    </h2>
                    <button onClick={onClose} disabled={disabling} className="text-aida-text-muted hover:text-aida-dark">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <ul className="space-y-2 list-disc pl-5 text-sm text-aida-text-muted">
                        <li>Anything on the server that is missing on this device will be downloaded first.</li>
                        <li>The encrypted server backup will then be <strong className="text-aida-dark">permanently deleted</strong>.</li>
                        <li>Other devices will show that the backup no longer exists and will stop syncing.</li>
                        <li>Your data on this device stays exactly as it is.</li>
                        <li>You can re-enable sync at any time with a new password.</li>
                    </ul>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-500">
                            <FiAlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {disabling && (
                        <div className="flex items-center gap-2 text-sm text-aida-text-muted">
                            <FiRefreshCw className="w-4 h-4 animate-spin text-aida-pink" />
                            Downloading, then deleting the backup...
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={disabling}
                            className="flex-1 px-4 py-2.5 border border-aida-border rounded-lg text-aida-dark font-medium hover:bg-aida-light disabled:opacity-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDisable}
                            disabled={disabling}
                            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                            {disabling ? 'Working...' : 'Disable and Delete'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DisableSyncModal;