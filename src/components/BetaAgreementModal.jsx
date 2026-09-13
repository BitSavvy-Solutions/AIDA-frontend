import React, { useState } from 'react';
import { FiAlertTriangle, FiCheck } from 'react-icons/fi';

const BetaAgreementModal = ({ isOpen, onClose, onAgree }) => {
    const [agreed, setAgreed] = useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-aida-card rounded-xl shadow-2xl w-full max-w-lg border border-aida-border max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <FiAlertTriangle className="w-6 h-6 text-amber-500" />
                        <h2 className="text-xl font-bold text-aida-dark">Beta Feature Agreement</h2>
                    </div>

                    <div className="space-y-4 text-sm text-aida-text-muted">
                        <p>
                            Encrypted profiles are a <strong className="text-aida-dark">beta feature</strong>.
                            By continuing, you acknowledge and agree to the following:
                        </p>

                        <ul className="space-y-2 list-disc pl-5">
                            <li>This is experimental software. There is no guarantee of data availability or durability.</li>
                            <li>Your data is encrypted end-to-end. We cannot recover it if you lose your password and recovery key.</li>
                            <li>Use a strong, unique password. We recommend a password manager.</li>
                            <li>You are solely responsible for the content you store. Do not store illegal, harmful, or infringing material.</li>
                            <li>We may reset or delete beta data at any time during development.</li>
                            <li>The free tier includes 500 MB of encrypted storage.</li>
                        </ul>

                        <label className="flex items-start gap-3 pt-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                                className="mt-1 w-4 h-4 rounded border-aida-border text-aida-pink focus:ring-aida-pink"
                            />
                            <span className="text-aida-dark">
                                I understand this is a beta feature and I accept the risks and responsibilities above.
                            </span>
                        </label>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-aida-border rounded-lg text-aida-dark font-medium hover:bg-aida-light transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onAgree}
                            disabled={!agreed}
                            className="flex-1 px-4 py-2.5 bg-aida-pink text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
                        >
                            <FiCheck className="w-4 h-4" />
                            I Agree
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BetaAgreementModal;