import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiLogOut, FiLogIn, FiPlus, FiLoader, FiStar } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import creditService from '../services/creditService';
import BuyCreditsModal from './BuyCreditsModal';

const Header = () => {
    const { isAuthenticated, user, logout } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams(); // To check URL for ?payment=success

    const [balance, setBalance] = useState(() => {
        // Check if we have a stored "pre-payment" balance first
        const stored = localStorage.getItem('aida_pre_payment_balance');
        
        console.log("--------------------------------");
        console.log("DEBUG: Initial Load Balance Check");
        console.log("Value found in localStorage:", stored); 
        console.log("--------------------------------");

        return stored ? parseFloat(stored) : 0.00;
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPolling, setIsPolling] = useState(false);

    const [notification, setNotification] = useState(null);

    // Ref to track if we are currently polling to prevent duplicate intervals
    const pollingRef = useRef(false);

    // 1. Fetch Balance on Load
    useEffect(() => {
        // Only fetch normally if we are NOT in the middle of a payment success flow
        if (isAuthenticated && user?.id && searchParams.get('payment') !== 'success') {
            fetchBalance();
        }
    }, [isAuthenticated, user, searchParams]);

    // 2. Handle Payment Success with Artificial Delay (Smart Polling)
    useEffect(() => {
        const paymentStatus = searchParams.get('payment');

        if (paymentStatus === 'success' && isAuthenticated && user?.id && !pollingRef.current) {
            pollingRef.current = true;
            setIsPolling(true);

            setNotification({
                type: 'processing',
                title: 'Processing Payment...',
                message: 'Please wait while we confirm with Stripe.'
            });

            const runArtificialDelay = async () => {
                try {
                    // A. Get the "Old" Balance from Memory
                    const rawStored = localStorage.getItem('aida_pre_payment_balance');
                    const oldBalance = rawStored ? parseFloat(rawStored) : 0;

                    // B. Force UI to show Old Balance immediately (The "Lie")
                    setBalance(oldBalance);

                    // C. Fetch the Real New Balance in the background
                    const newBalance = await creditService.getBalance(user.id);

                    // D. Wait for 5 seconds (Artificial Delay for UX)
                    // This gives the user time to see the spinner and "feel" the processing
                    setTimeout(() => {
                        // E. The Reveal
                        setBalance(newBalance); // Update number
                        setIsPolling(false);    // Stop spinner

                        // --- 2. SHOW SUCCESS ALERT ---
                        setNotification({
                            type: 'success',
                            title: 'Payment Successful!',
                            message: `Your new balance is $${newBalance.toFixed(2)}`
                        });
                        
                        // Cleanup
                        localStorage.removeItem('aida_pre_payment_balance');
                        navigate('/', { replace: true }); // Clear URL

                        // --- 3. AUTO HIDE ALERT AFTER 4 SECONDS ---
                        setTimeout(() => setNotification(null), 4000);

                    }, 5000); // 5s delay

                } catch (e) {
                    console.error("Error during payment sync", e);
                    setIsPolling(false);
                    // Optional: Show error alert
                    setNotification({ type: 'error', title: 'Error', message: 'Could not sync balance.' });
                }
            };

            runArtificialDelay();
        }
    }, [searchParams, isAuthenticated, user, navigate]);

    const fetchBalance = async () => {
        if (user?.id) {
            try {
                const bal = await creditService.getBalance(user.id);
                setBalance(bal);
            } catch (e) {
                console.error("Balance fetch error", e);
            }
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const getBalanceColor = (amount) => {
        if (amount > 0) return 'text-green-600 dark:text-green-400';
        if (amount < 0) return 'text-red-600 dark:text-red-400';
        return 'text-gray-700 dark:text-gray-200';
    }

    return (
        <>
            <header className="bg-aida-card/80 backdrop-blur-md border-b border-aida-border sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <Link to="/" className="flex items-center space-x-2">
                            <HiSparkles className="w-8 h-8 text-aida-pink animate-pulse" />
                            <span className="text-2xl font-bold text-aida-dark">AIDA</span>
                        </Link>
                        
                        <div className="flex items-center space-x-4">
                            {isAuthenticated && user ? (
                                <div className="flex items-center space-x-3">

                                    {/* --- NEW: Balance Display --- */}
                                    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1 border border-gray-200 dark:border-gray-700">
                                        {/* Spinner shows NEXT to balance */}
                                        {isPolling && (
                                            <FiLoader className="animate-spin text-pink-500 mr-2" title="Updating balance..." />
                                        )}

                                        <span className={`text-sm font-bold mr-2 ${getBalanceColor(balance)}`}>
                                            ${typeof balance === 'number' ? balance.toFixed(2) : '0.00'}
                                        </span>

                                        <button 
                                            onClick={() => setIsModalOpen(true)}
                                            className="bg-aida-pink hover:bg-pink-600 text-white rounded-full p-1 transition-colors"
                                            title="Add Credits"
                                        >
                                            <FiPlus size={14} />
                                        </button>
                                    </div>
                                    {/* ---------------------------- */}

                                    <span className="text-sm font-medium text-aida-dark hidden sm:block">
                                        {user.name}
                                    </span>
                                    <button 
                                        onClick={handleLogout} 
                                        className="text-aida-text-muted hover:text-aida-pink transition-colors"
                                        title="Logout"
                                    >
                                        <FiLogOut className="w-5 h-5"/>
                                    </button>
                                </div>
                            ) : (
                                <Link
                                    to="/login"
                                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-aida-pink rounded-lg hover:opacity-90 transition-opacity"
                                >
                                    <FiLogIn className="mr-2 h-4 w-4"/>
                                    Login
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Render the Modal */}
            <BuyCreditsModal 
                userId={user?.id} 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                currentBalance={balance}
            />

            {/* --- SNACKBAR ALERT --- */}
            {notification && (
                <div className="fixed bottom-6 left-6 z-[3000] animate-slide-up">
                    <div className={`flex items-center gap-4 px-5 py-4 rounded-xl shadow-2xl border ${
                        notification.type === 'processing' 
                            ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
                            : 'bg-green-50 dark:bg-green-900/80 border-green-200 dark:border-green-800'
                    }`}>
                        {/* Icon Logic */}
                        <div className={`p-2 rounded-full ${
                            notification.type === 'processing' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-green-100 dark:bg-green-900/50'
                        }`}>
                            {notification.type === 'processing' ? (
                                <FiLoader className="w-6 h-6 text-blue-500 animate-spin" />
                            ) : (
                                <FiStar className="w-6 h-6 text-green-600 dark:text-green-400 fill-current" />
                            )}
                        </div>

                        {/* Text Content */}
                        <div>
                            <h4 className={`text-sm font-bold ${
                                notification.type === 'processing' ? 'text-gray-900 dark:text-white' : 'text-green-800 dark:text-green-200'
                            }`}>
                                {notification.title}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {notification.message}
                            </p>
                        </div>

                        {/* Close Button (Optional) */}
                        <button 
                            onClick={() => setNotification(null)}
                            className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        >
                            <span className="sr-only">Close</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default Header;