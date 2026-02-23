import React, { useState } from 'react';
import { FiX, FiCreditCard, FiLoader, FiDollarSign } from 'react-icons/fi';
import creditService from '../services/creditService';

const BuyCreditsModal = ({ userId, isOpen, onClose, currentBalance }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [customAmount, setCustomAmount] = useState('');

    if (!isOpen) return null;

    const handleBuy = async (amount) => {
        const value = parseFloat(amount);
        if (isNaN(value) || value < 1.00) {
            setError('Minimum amount is $1.00');
            return;
        }

        setLoading(true);
        setError('');
        try {
            // --- SAVE THE OLD BALANCE BEFORE LEAVING ---
            localStorage.setItem('aida_pre_payment_balance', currentBalance || 0);
            // 1. Call your Azure Backend
            const stripeUrl = await creditService.createCheckoutSession(userId, amount);
            // 2. Redirect to Stripe
            window.location.href = stripeUrl;
        } catch (err) {
            setError('Failed to initialize payment. Please try again.');
            setLoading(false);
        }
    };

    const handleCustomSubmit = (e) => {
        e.preventDefault();
        handleBuy(customAmount);
    };

    const amounts = [10, 20, 50, 100];

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 relative border border-gray-200 dark:border-gray-700">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FiCreditCard className="text-pink-500" />
                        Add Credits
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <FiX size={24} />
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-8">
                        <FiLoader className="animate-spin text-pink-500 w-10 h-10 mb-3" />
                        <p className="text-gray-600 dark:text-gray-300">Redirecting to Stripe...</p>
                    </div>
                ) : (
                    <>
                        {/* Preset amounts */}
                        <div className="grid grid-cols-2 gap-4">
                            {amounts.map((amount) => (
                                <button
                                    key={amount}
                                    onClick={() => handleBuy(amount)}
                                    className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-all group"
                                >
                                    <span className="text-2xl font-bold text-gray-800 dark:text-white group-hover:text-pink-600">
                                        ${amount}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">USD</span>
                                </button>
                            ))}
                        </div>

                        {/* Custom Amount Input */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-2 bg-white dark:bg-gray-800 text-sm text-gray-500">or enter custom amount</span>
                            </div>
                        </div>

                        <form onSubmit={handleCustomSubmit} className="mt-4 flex gap-2">
                            <div className="relative flex-grow">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FiDollarSign className="text-gray-400" />
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="1.00"
                                    placeholder="0.00"
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 sm:text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!customAmount || parseFloat(customAmount) < 1}
                                className="px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-lg hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Pay
                            </button>
                        </form>
                    </>
                )}

                <p className="mt-6 text-xs text-center text-gray-400">
                    Payments are securely processed by Stripe.
                </p>
            </div>
        </div>
    );
};

export default BuyCreditsModal;