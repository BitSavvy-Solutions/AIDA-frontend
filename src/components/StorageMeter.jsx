// src/components/StorageMeter.jsx
import React from 'react';
import { FiHardDrive } from 'react-icons/fi';

const StorageMeter = () => {
    return (
        <div className="bg-aida-card border border-aida-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
                <FiHardDrive className="w-4 h-4 text-aida-text-muted" />
                <h3 className="text-sm font-semibold text-aida-dark">Encrypted Storage</h3>
            </div>
            <p className="text-xs text-aida-text-muted">
                Storage usage is tracked per account. Check your Account page for details.
            </p>
        </div>
    );
};

export default StorageMeter;