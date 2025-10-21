import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiLogOut, FiLogIn } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

const Header = () => {
    const { isAuthenticated, user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
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
    );
};

export default Header;