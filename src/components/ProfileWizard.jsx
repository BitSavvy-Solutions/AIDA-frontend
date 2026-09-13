import React, { useState } from 'react';
import { FiX, FiLock, FiDownload, FiCopy, FiCheck } from 'react-icons/fi';
import { useProfile } from '../contexts/ProfileContext';

const ProfileWizard = ({ isOpen, onClose }) => {
    const { createProfile } = useProfile();
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [syncEnabled, setSyncEnabled] = useState(true);
    const [recoveryKey, setRecoveryKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

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
            const { recoveryKey: key } = await createProfile({ name, password, syncEnabled });
            setRecoveryKey(key);
            setStep(3);
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
        a.download = `aida-recovery-key-${name.replace(/\s+/g, '-').toLowerCase()}.txt`;
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
        setName('');
        setPassword('');
        setConfirmPassword('');
        setSyncEnabled(true);
        setRecoveryKey('');
        setError('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-aida-card rounded-xl shadow-2xl w-full max-w-md border border-aida-border">
                <div className="flex items-center justify-between p-4 border-b border-aida-border">
                    <h2 className="text-lg font-bold text-aida-dark flex items-center gap-2">
                        <FiLock className="w-5 h-5 text-aida-pink" />
                        Create Encrypted Profile
                    </h2>
                    <button onClick={reset} className="text-aida-text-muted hover:text-aida-dark">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-aida-dark mb-1">Profile Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Work, Personal, Research"
                                    className="w-full px-3 py-2 border border-aida-border rounded-lg bg-aida-light text-aida-dark focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-aida-dark mb-1">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="At least 8 characters"
                                    className="w-full px-3 py-2 border border-aida-border rounded-lg bg-aida-light text-aida-dark focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                                />
                                {password && (
                                    <p className={`text-xs mt-1 ${strength.color}`}>
                                        Strength: {strength.label}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-aida-dark mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-aida-border rounded-lg bg-aida-light text-aida-dark focus:ring-2 focus:ring-aida-pink focus:border-transparent"
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={syncEnabled}
                                    onChange={(e) => setSyncEnabled(e.target.checked)}
                                    className="w-4 h-4 rounded border-aida-border text-aida-pink focus:ring-aida-pink"
                                />
                                <span className="text-sm text-aida-dark">Enable encrypted sync across devices</span>
                            </label>

                            {error && <p className="text-sm text-red-500">{error}</p>}

                            <button
                                onClick={() => setStep(2)}
                                disabled={!name || !password || !confirmPassword}
                                className="w-full px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                                <p className="text-sm text-amber-700 dark:text-amber-300">
                                    <strong>Important:</strong> Your password encrypts your data. If you forget it,
                                    your data cannot be recovered. You will get a recovery key on the next step.
                                </p>
                            </div>

                            <div className="text-sm text-aida-text-muted space-y-2">
                                <p>Profile: <strong className="text-aida-dark">{name}</strong></p>
                                <p>Sync: <strong className="text-aida-dark">{syncEnabled ? 'Enabled' : 'Disabled'}</strong></p>
                            </div>

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
                                    disabled={loading}
                                    className="flex-1 px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                                >
                                    {loading ? 'Creating...' : 'Create Profile'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                <p className="text-sm text-green-700 dark:text-green-300">
                                    Profile created successfully! Save your recovery key now.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-aida-dark mb-2">Recovery Key</label>
                                <div className="bg-aida-light border border-aida-border rounded-lg p-3 font-mono text-sm text-aida-dark break-all">
                                    {recoveryKey}
                                </div>
                                <p className="text-xs text-aida-text-muted mt-2">
                                    Store this somewhere safe. It is the only way to recover your data if you forget your password.
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
        </div>
    );
};

export default ProfileWizard;