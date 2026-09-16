import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    FiX, FiGlobe, FiDownload, FiCopy, FiCheck,
    FiEye, FiEyeOff, FiAlertTriangle,
} from 'react-icons/fi';
import { useVault } from '../contexts/VaultContext';
import { db } from '../services/db';

const EnableSyncModal = ({ isOpen, onClose }) => {
    const { enableSync } = useVault();
    const [step, setStep] = useState(1);
    const [agreed, setAgreed] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [recoveryKey, setRecoveryKey] = useState('');
    const [savedKey, setSavedKey] = useState(false);
    const [adoptedInfo, setAdoptedInfo] = useState(null);
    const [counts, setCounts] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        let alive = true;
        (async () => {
            try {
                const meta = await db.chats.getMeta();
                const projects = await db.projects.toArray();
                if (alive) setCounts({ chats: meta.count, messages: meta.msgs, projects: projects.length });
            } catch { /* counts are informational only */ }
        })();
        return () => { alive = false; };
    }, [isOpen]);

    if (!isOpen) return null;

    const passwordStrength = (pwd) => {
        if (pwd.length < 8) return { score: 0, label: 'Too short', color: 'text-red-500' };
        let score = 0;
        if (pwd.length >= 12) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;
        const labels = ['Weak', 'Fair', 'Good', 'Strong'];
        const colors = ['text-red-500', 'text-amber-500', 'text-blue-500', 'text-green-500'];
        return { score, label: labels[score], color: colors[score] };
    };
    const strength = passwordStrength(password);

    const handleCreate = async () => {
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const result = await enableSync({ password });
            if (result.adopted) {
                setAdoptedInfo(result);
                setStep(4);
            } else {
                setRecoveryKey(result.recoveryKey);
                setStep(3);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const downloadRecoveryKey = () => {
        const blob = new Blob([recoveryKey], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'aida-recovery-key.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyRecoveryKey = () => {
        navigator.clipboard.writeText(recoveryKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const reset = () => {
        setStep(1);
        setAgreed(false);
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setRecoveryKey('');
        setSavedKey(false);
        setAdoptedInfo(null);
        setError('');
        onClose();
    };

    const hasLocalData = counts && (counts.chats > 0 || counts.projects > 0);

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-aida-card rounded-xl shadow-2xl w-full max-w-md border border-aida-border max-h-[90vh] overflow-y-auto my-auto">
                <div className="flex items-center justify-between p-4 border-b border-aida-border">
                    <h2 className="text-lg font-bold text-aida-dark flex items-center gap-2">
                        <FiGlobe className="w-5 h-5 text-aida-pink" />
                        Enable Encrypted Sync
                    </h2>
                    <button onClick={reset} className="text-aida-text-muted hover:text-aida-dark">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-amber-500">
                                <FiAlertTriangle className="w-5 h-5" />
                                <h3 className="font-semibold text-aida-dark">Beta feature, please read</h3>
                            </div>
                            <ul className="space-y-2 list-disc pl-5 text-sm text-aida-text-muted">
                                <li>Your data is encrypted on this device before it is sent to the server. We cannot read it.</li>
                                <li>This is experimental software. There is no guarantee of data availability or durability.</li>
                                <li>You need your password or recovery key to read the backup on a new device.</li>
                                <li>If you forget both, the server backup becomes unreadable. Your local data on this device always stays intact.</li>
                                <li>You are responsible for the content you store. Do not store illegal, harmful, or infringing material.</li>
                                <li>The free tier includes 500 MB of encrypted storage.</li>
                            </ul>

                            <label className="flex items-start gap-3 pt-1 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={agreed}
                                    onChange={(e) => setAgreed(e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded border-aida-border text-aida-pink focus:ring-aida-pink"
                                />
                                <span className="text-sm text-aida-dark">
                                    I understand this is a beta feature and I accept the risks above.
                                </span>
                            </label>

                            <button
                                onClick={() => setStep(2)}
                                disabled={!agreed}
                                className="w-full px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            {hasLocalData && (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                                    You have {counts.chats} chat(s) with {counts.messages} message(s)
                                    {counts.projects > 0 ? ` and ${counts.projects} project(s)` : ''} on
                                    this device. They will be encrypted and synced to the server.
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-aida-dark mb-1">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="At least 8 characters"
                                        className="w-full px-3 py-2 pr-10 border border-aida-border rounded-lg bg-aida-light text-aida-dark focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(p => !p)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-aida-text-muted hover:text-aida-dark"
                                    >
                                        {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {password && (
                                    <p className={`text-xs mt-1 ${strength.color}`}>
                                        Strength: {strength.label}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-aida-dark mb-1">Confirm Password</label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-aida-border rounded-lg bg-aida-light text-aida-dark focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                                />
                            </div>

                            <p className="text-xs text-aida-text-muted">
                                After setup, changes are encrypted and synced automatically every couple of
                                minutes, and whenever this tab becomes visible.
                            </p>

                            {error && <p className="text-sm text-red-500">{error}</p>}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 px-4 py-2.5 border border-aida-border rounded-lg text-aida-dark font-medium hover:bg-aida-light transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={loading || !password || !confirmPassword}
                                    className="flex-1 px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                                >
                                    {loading ? 'Setting up...' : 'Enable Sync'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                <p className="text-sm text-green-700 dark:text-green-300">
                                    Encrypted sync is on. Save your recovery key now.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-aida-dark mb-2">Recovery Key</label>
                                <div className="bg-aida-light border border-aida-border rounded-lg p-3 font-mono text-sm text-aida-dark break-all">
                                    {recoveryKey}
                                </div>
                                <p className="text-xs text-aida-text-muted mt-2">
                                    This is the only way to unlock the backup on a new device if you forget
                                    your password. It is shown once and cannot be displayed again.
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={copyRecoveryKey}
                                    className="flex-1 px-3 py-2 border border-aida-border rounded-lg text-aida-dark text-sm font-medium hover:bg-aida-light transition-colors flex items-center justify-center gap-2"
                                >
                                    {copied ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                                <button
                                    onClick={downloadRecoveryKey}
                                    className="flex-1 px-3 py-2 border border-aida-border rounded-lg text-aida-dark text-sm font-medium hover:bg-aida-light transition-colors flex items-center justify-center gap-2"
                                >
                                    <FiDownload className="w-4 h-4" />
                                    Download
                                </button>
                            </div>

                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={savedKey}
                                    onChange={(e) => setSavedKey(e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded border-aida-border text-aida-pink focus:ring-aida-pink"
                                />
                                <span className="text-sm text-aida-dark">I have saved my recovery key somewhere safe.</span>
                            </label>

                            <button
                                onClick={reset}
                                disabled={!savedKey}
                                className="w-full px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            >
                                Done
                            </button>
                        </div>
                    )}

                    {step === 4 && adoptedInfo && (
                        <div className="space-y-4">
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    This account already had encrypted sync set up on another device, so this
                                    device has been connected to it.
                                    {adoptedInfo.unlocked
                                        ? ' Your password worked, syncing will start now.'
                                        : ' Enter your original password in the unlock prompt to start syncing.'}
                                </p>
                            </div>
                            <button
                                onClick={reset}
                                className="w-full px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default EnableSyncModal;