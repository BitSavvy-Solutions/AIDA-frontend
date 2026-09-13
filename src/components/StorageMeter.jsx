import React, { useState, useEffect } from 'react';
import { FiHardDrive } from 'react-icons/fi';
import { vaultApi } from '../services/vaultApi';

const StorageMeter = () => {
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const data = await vaultApi.getUsage();
                setUsage(data);
            } catch (e) {
                console.error('Failed to fetch usage:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchUsage();
    }, []);

    if (loading || !usage) return null;

    const usedMB = (usage.usedBytes / (1024 * 1024)).toFixed(1);
    const quotaMB = (usage.quotaBytes / (1024 * 1024)).toFixed(0);
    const percent = Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100);

    return (
        <div className="bg-aida-card border border-aida-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
                <FiHardDrive className="w-4 h-4 text-aida-text-muted" />
                <h3 className="text-sm font-semibold text-aida-dark">Encrypted Storage</h3>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-aida-text-muted">
                    <span>{usedMB} MB used</span>
                    <span>{quotaMB} MB total</span>
                </div>
                <div className="w-full bg-aida-light rounded-full h-2 border border-aida-border">
                    <div
                        className={`h-2 rounded-full transition-all ${
                            percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-amber-500' : 'bg-aida-pink'
                        }`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
                {percent > 90 && (
                    <p className="text-xs text-red-500 mt-1">
                        Storage almost full. Consider deleting old profiles or upgrading.
                    </p>
                )}
            </div>
        </div>
    );
};

export default StorageMeter;