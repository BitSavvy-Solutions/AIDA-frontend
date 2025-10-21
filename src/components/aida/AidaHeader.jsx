/* src/components/aida/AidaHeader.jsx */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../contexts/AuthContext';
import { FaGithub, FaGoogle } from 'react-icons/fa';
import { HiSparkles, HiArrowRightOnRectangle, HiChevronDown } from 'react-icons/hi2';
import { Menu } from '@headlessui/react';
import clsx from 'clsx';

const AidaHeader = () => {
    const { isAuthenticated, user, loginWithGoogle, logout } = useAuth();
    const navigate = useNavigate();

    const handleGoogleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                const userInfo = await res.json();
                await loginWithGoogle(userInfo);
                // No navigation, just update state
            } catch (error) {
                console.error('❌ Google Login Failed:', error);
            }
        },
        onError: () => console.error('Google Auth Failed'),
        flow: 'implicit',
    });

    const handleLogout = () => {
        logout();
        navigate('/aida'); // Stay on the AIDA page after logout
    };

    return (
        <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link to="/aida" className="flex items-center space-x-2">
                        <HiSparkles className="w-8 h-8 text-[#FF5F90] animate-pulse" />
                        <span className="text-xl font-bold text-gray-900">AIDA</span>
                    </Link>

                    {/* Right side: GitHub link and Auth */}
                    <div className="flex items-center space-x-4">
                        <a 
                            href="https://github.com/aitutor-project" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-gray-900 transition-colors"
                            aria-label="GitHub Repository"
                        >
                            <FaGithub className="w-6 h-6" />
                        </a>

                        {isAuthenticated && user ? (
                             <Menu as="div" className="relative">
                                <Menu.Button className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors duration-200">
                                    <div className="w-8 h-8 bg-gradient-to-br from-[#FF5F90] to-red-500 rounded-full flex items-center justify-center">
                                        <img
                                            src={user.picture || user.avatar}
                                            alt={user.name}
                                            className="w-8 h-8 rounded-full object-cover"
                                        />
                                    </div>
                                    <span className="hidden sm:block">{user.name}</span>
                                    <HiChevronDown className="w-4 h-4" />
                                </Menu.Button>
                                <Menu.Items className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                <div className="py-1">
                                    <div className="px-4 py-2 border-b border-gray-100">
                                        <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                    </div>
                                    <Menu.Item>
                                        {({ active }) => (
                                          <button
                                            onClick={handleLogout}
                                            className={clsx(
                                              active ? 'bg-gray-100' : '',
                                              'block px-4 py-2 text-sm text-gray-700 w-full text-left'
                                            )}
                                          >
                                            <HiArrowRightOnRectangle className="w-4 h-4 inline mr-2" />
                                            Sign Out
                                          </button>
                                        )}
                                    </Menu.Item>
                                </div>
                                </Menu.Items>
                            </Menu>
                        ) : (
                            <button
                                onClick={() => handleGoogleLogin()}
                                className="flex items-center justify-center px-4 py-2 bg-white text-gray-800 border border-gray-300 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
                            >
                                <FaGoogle className="w-4 h-4 mr-2" />
                                Sign in with Google
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default AidaHeader;