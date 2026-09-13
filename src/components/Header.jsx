// src/components/Header.jsx
import React, { useEffect, useState, useRef, Fragment } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { useAuth } from '../contexts/AuthContext';
import { FiLogOut, FiLogIn, FiPlus, FiLoader, FiStar, FiMenu, FiX, FiUser, FiHome, FiSun, FiMoon } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import creditService from '../services/creditService';
import BuyCreditsModal from './BuyCreditsModal';
import ProfileSwitcher from './ProfileSwitcher';

const Header = () => {
    const { isAuthenticated, user, logout } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // --- THEME STATE ---
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('aida_theme') || 'light';
    });

    // Apply theme globally to the <html> tag
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('aida_theme', theme);
    }, [theme]);
    // -------------------

    const [balance, setBalance] = useState(() => {
        const stored = localStorage.getItem('aida_pre_payment_balance');
        return stored ? parseFloat(stored) : 0.00;
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [notification, setNotification] = useState(null);
    const pollingRef = useRef(false);

    useEffect(() => {
        if (isAuthenticated && user?.id && searchParams.get('payment') !== 'success') {
            fetchBalance();
        }
    }, [isAuthenticated, user, searchParams]);

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
                    const rawStored = localStorage.getItem('aida_pre_payment_balance');
                    const oldBalance = rawStored ? parseFloat(rawStored) : 0;

                    setBalance(oldBalance);

                    const newBalance = await creditService.getBalance(user.id);

                    setTimeout(() => {
                        setBalance(newBalance);
                        setIsPolling(false);

                        setNotification({
                            type: 'success',
                            title: 'Payment Successful!',
                            message: `Your new balance is $${newBalance.toFixed(2)}`
                        });

                        localStorage.removeItem('aida_pre_payment_balance');
                        navigate('/', { replace: true });

                        setTimeout(() => setNotification(null), 4000);

                    }, 5000);

                } catch (e) {
                    console.error("Error during payment sync", e);
                    setIsPolling(false);
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
    };

    return (
        <>
            <Disclosure as="header" className="bg-aida-card/80 backdrop-blur-md border-b border-aida-border dark:border-gray-800 sticky top-0 z-50 transition-colors">
                {({ open, close }) => (
                    <>
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex justify-between items-center h-16">
                                <Link to="/" className="flex items-center space-x-2">
                                    <HiSparkles className="w-8 h-8 text-aida-pink animate-pulse" />
                                    <span className="text-2xl font-bold text-aida-dark dark:text-white">AIDA</span>
                                </Link>

                                <div className="flex items-center space-x-4">
                                    {isAuthenticated && user ? (
                                        <div className="flex items-center space-x-3">
                                            {/* Balance Pill */}
                                            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1 border border-gray-200 dark:border-gray-700">
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

                                            <div className="hidden sm:flex">
                                                <ProfileSwitcher />
                                            </div>


                                            {/* Desktop Profile Dropdown */}
                                            <div className="hidden sm:block">
                                                <Menu as="div" className="relative ml-3">
                                                    <div>
                                                        <Menu.Button className="flex items-center max-w-xs text-sm bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aida-pink transition-transform hover:scale-105">
                                                            <span className="sr-only">Open user menu</span>
                                                            {user?.avatar ? (
                                                                <img className="w-8 h-8 rounded-full object-cover" src={user.avatar} alt={user.name} />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-aida-pink to-pink-600 flex items-center justify-center text-white font-bold">
                                                                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                                                </div>
                                                            )}
                                                        </Menu.Button>
                                                    </div>
                                                    <Transition
                                                        as={Fragment}
                                                        enter="transition ease-out duration-100"
                                                        enterFrom="transform opacity-0 scale-95"
                                                        enterTo="transform opacity-100 scale-100"
                                                        leave="transition ease-in duration-75"
                                                        leaveFrom="transform opacity-100 scale-100"
                                                        leaveTo="transform opacity-0 scale-95"
                                                    >
                                                        <Menu.Items className="absolute right-0 w-56 mt-2 origin-top-right bg-white dark:bg-[#1e293b] border border-gray-100 dark:border-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none py-1 overflow-hidden">
                                                            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700/50">
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">Signed in as</p>
                                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email || 'User Account'}</p>
                                                            </div>

                                                            {/* THEME TOGGLE (Desktop) */}
                                                            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700/50">
                                                                <div className="flex items-center bg-gray-100 dark:bg-[#0f172a] rounded-lg p-1">
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); setTheme('light'); }}
                                                                        className={`flex-1 flex justify-center items-center py-1.5 rounded-md transition-all duration-200 ${theme === 'light'
                                                                            ? 'bg-white text-gray-900 shadow-sm'
                                                                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                                                            }`}
                                                                    >
                                                                        <FiSun className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); setTheme('dark'); }}
                                                                        className={`flex-1 flex justify-center items-center py-1.5 rounded-md transition-all duration-200 ${theme === 'dark'
                                                                            ? 'bg-[#1e293b] text-white shadow-sm'
                                                                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                                                            }`}
                                                                    >
                                                                        <FiMoon className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <Menu.Item>
                                                                {({ active }) => (
                                                                    <Link
                                                                        to="/dashboard"
                                                                        className={`${active ? 'bg-gray-50 dark:bg-gray-700 text-aida-pink' : 'text-gray-700 dark:text-gray-200'} flex items-center px-4 py-2 text-sm transition-colors`}
                                                                    >
                                                                        <FiHome className="mr-2" /> Dashboard
                                                                    </Link>
                                                                )}
                                                            </Menu.Item>
                                                            <Menu.Item>
                                                                {({ active }) => (
                                                                    <Link
                                                                        to="/account"
                                                                        className={`${active ? 'bg-gray-50 dark:bg-gray-700 text-aida-pink' : 'text-gray-700 dark:text-gray-200'} flex items-center px-4 py-2 text-sm transition-colors`}
                                                                    >
                                                                        <FiUser className="mr-2" /> Account
                                                                    </Link>
                                                                )}
                                                            </Menu.Item>
                                                            <Menu.Item>
                                                                {({ active }) => (
                                                                    <button
                                                                        onClick={handleLogout}
                                                                        className={`${active ? 'bg-gray-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'} flex w-full items-center px-4 py-2 text-sm transition-colors`}
                                                                    >
                                                                        <FiLogOut className="mr-2" /> Sign out
                                                                    </button>
                                                                )}
                                                            </Menu.Item>
                                                        </Menu.Items>
                                                    </Transition>
                                                </Menu>
                                            </div>

                                            {/* Mobile Menu Button */}
                                            <div className="flex sm:hidden">
                                                <Disclosure.Button className="inline-flex items-center justify-center p-2 text-gray-400 rounded-md hover:text-aida-pink hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-aida-pink">
                                                    <span className="sr-only">Open main menu</span>
                                                    {open ? (
                                                        <FiX className="block w-6 h-6" aria-hidden="true" />
                                                    ) : (
                                                        <FiMenu className="block w-6 h-6" aria-hidden="true" />
                                                    )}
                                                </Disclosure.Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <Link
                                            to="/login"
                                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-aida-pink rounded-lg hover:opacity-90 transition-opacity"
                                        >
                                            <FiLogIn className="mr-2 h-4 w-4" />
                                            Join Beta
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Invisible overlay to detect clicks outside the mobile menu */}
                        {open && (
                            <button
                                type="button"
                                className="fixed inset-0 top-16 z-40 w-full h-full bg-transparent cursor-default sm:hidden"
                                onClick={() => close()}
                                tabIndex={-1}
                            />
                        )}

                        {/* Mobile Navigation Panel */}
                        <Disclosure.Panel className="sm:hidden bg-white dark:bg-[#1e293b] border-t border-gray-100 dark:border-gray-800 shadow-lg absolute w-full z-50">
                            {isAuthenticated && user && (
                                <div className="pt-4 pb-3 border-t border-gray-200">
                                    <div className="flex items-center px-5 space-x-3">
                                        <div className="flex-shrink-0">
                                            {user?.avatar ? (
                                                <img className="w-10 h-10 rounded-full object-cover" src={user.avatar} alt={user.name} />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-aida-pink to-pink-600 flex items-center justify-center text-white font-bold text-lg">
                                                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-base font-medium text-gray-800 dark:text-white">{user.name}</div>
                                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{user.email || 'User Account'}</div>
                                        </div>
                                    </div>

                                    {/* THEME TOGGLE (Mobile) */}
                                    <div className="px-5 mb-4">
                                        <div className="flex items-center bg-gray-100 dark:bg-[#0f172a] rounded-lg p-1">
                                            <button
                                                onClick={() => setTheme('light')}
                                                className={`flex-1 flex justify-center items-center py-2 rounded-md transition-all duration-200 ${theme === 'light'
                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                    : 'text-gray-500 dark:text-gray-400'
                                                    }`}
                                            >
                                                <FiSun className="w-5 h-5 mr-2" /> Light
                                            </button>
                                            <button
                                                onClick={() => setTheme('dark')}
                                                className={`flex-1 flex justify-center items-center py-2 rounded-md transition-all duration-200 ${theme === 'dark'
                                                    ? 'bg-[#1e293b] text-white shadow-sm'
                                                    : 'text-gray-500 dark:text-gray-400'
                                                    }`}
                                            >
                                                <FiMoon className="w-5 h-5 mr-2" /> Dark
                                            </button>
                                        </div>
                                    </div>

                                    <div className="px-5 mt-4 mb-2">
                                        <ProfileSwitcher />
                                    </div>

                                    <div className="px-2 mt-3 space-y-1">
                                        <Disclosure.Button
                                            as={Link}
                                            to="/dashboard"
                                            className="flex items-center px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 rounded-md hover:text-aida-pink hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                        >
                                            <FiHome className="mr-3" /> Dashboard
                                        </Disclosure.Button>
                                        <Disclosure.Button
                                            as={Link}
                                            to="/account"
                                            className="flex items-center px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 rounded-md hover:text-aida-pink hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                        >
                                            <FiUser className="mr-3" /> Account
                                        </Disclosure.Button>
                                        <Disclosure.Button
                                            as="button"
                                            onClick={handleLogout}
                                            className="flex items-center w-full px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 rounded-md hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-red-900/20"
                                        >
                                            <FiLogOut className="mr-3" /> Sign out
                                        </Disclosure.Button>
                                    </div>
                                </div>
                            )}
                        </Disclosure.Panel>
                    </>
                )}
            </Disclosure>

            <BuyCreditsModal
                userId={user?.id}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                currentBalance={balance}
            />

            {notification && (
                <div className="fixed bottom-6 left-6 z-[3000] animate-slide-up">
                    <div className={`flex items-center gap-4 px-5 py-4 rounded-xl shadow-2xl border ${notification.type === 'processing'
                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        : 'bg-green-50 dark:bg-green-900/80 border-green-200 dark:border-green-800'
                        }`}>
                        <div className={`p-2 rounded-full ${notification.type === 'processing' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-green-100 dark:bg-green-900/50'
                            }`}>
                            {notification.type === 'processing' ? (
                                <FiLoader className="w-6 h-6 text-blue-500 animate-spin" />
                            ) : (
                                <FiStar className="w-6 h-6 text-green-600 dark:text-green-400 fill-current" />
                            )}
                        </div>

                        <div>
                            <h4 className={`text-sm font-bold ${notification.type === 'processing' ? 'text-gray-900 dark:text-white' : 'text-green-800 dark:text-green-200'
                                }`}>
                                {notification.title}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {notification.message}
                            </p>
                        </div>

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