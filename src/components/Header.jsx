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

    const [balance, setBalance] = useState(0.00);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPolling, setIsPolling] = useState(false);

    // Ref to track if we are currently polling to prevent duplicate intervals
    const pollingRef = useRef(false);

    // 1. Fetch Balance on Load
    useEffect(() => {
        if (isAuthenticated && user?.id) {
            fetchBalance();
        }
    }, [isAuthenticated, user]);

    // 2. Handle Payment Success (Smart Polling)
    useEffect(() => {
    const paymentStatus = searchParams.get('payment');

    if (!(paymentStatus === 'success' && isAuthenticated && user?.id && !pollingRef.current)) {
        return;
    }

    pollingRef.current = true;
    setIsPolling(true);

    let intervalId;
    let timeoutId;
    let baseline = 0;

    const start = async () => {
        try {
            // A. Get baseline balance once
            baseline = await creditService.getBalance(user.id);
            setBalance(baseline);

            // B. Start polling
            intervalId = setInterval(async () => {
                try {
                    const newBalance = await creditService.getBalance(user.id);
                    setBalance(newBalance);

                    // If balance increased, stop early
                    if (newBalance > baseline) {
                        clearInterval(intervalId);
                        clearTimeout(timeoutId);
                        setIsPolling(false);
                        pollingRef.current = false;
                        navigate('/', { replace: true }); // clear ?payment=success
                    }
                } catch (e) {
                    console.error('Polling error', e);
                }
            }, 2000);

            // C. Safety timeout
            timeoutId = setTimeout(() => {
                clearInterval(intervalId);
                setIsPolling(false);
                pollingRef.current = false;
                navigate('/', { replace: true });
            }, 15000);
        } catch (e) {
            console.error('Initial balance fetch failed', e);
            setIsPolling(false);
            pollingRef.current = false;
        }
    };

    start();

    // Proper cleanup function
    return () => {
        if (intervalId) clearInterval(intervalId);
        if (timeoutId) clearTimeout(timeoutId);
        pollingRef.current = false;
    };
}, [searchParams, isAuthenticated, user?.id, navigate]);

    const fetchBalance = async () => {
        if (user?.id) {
            const bal = await creditService.getBalance(user.id);
            setBalance(bal);
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
                                        {/* Spinner shows NEXT to balance, not replacing it */}
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
            />
        </>
    );
};

export default Header;