import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { FiLogIn, FiAlertCircle } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';

const LoginPage = () => {
    const [error, setError] = useState('');
    const { processLogin, isAuthenticated, authLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            navigate('/');
        }
    }, [isAuthenticated, authLoading, navigate]);

    const handleGoogleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setError('');
            try {
                const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const userInfo = await res.json();
                
                await processLogin({
                    id: userInfo.id,
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    provider: 'google'
                });

                navigate('/'); // Redirect to home page after login
            } catch (err) {
                console.error("Google login process failed:", err);
                setError('Failed to process login. Please try again.');
            }
        },
        onError: () => {
            setError('Google authentication failed. Please try again.');
        },
    });

    return (
        <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg border">
                <div className="text-center">
                    <FiLogIn className="mx-auto h-12 w-12 text-aida-pink" />
                    <h2 className="mt-6 text-3xl font-bold text-gray-900">Sign in to AIDA</h2>
                    <p className="mt-2 text-sm text-gray-600">to save conversations and track usage</p>
                </div>
                
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative flex items-center">
                        <FiAlertCircle className="mr-2"/>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}
                
                <button
                    onClick={handleGoogleLogin}
                    disabled={authLoading}
                    className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    <FcGoogle className="w-6 h-6 mr-3" />
                    Sign in with Google
                </button>
            </div>
        </div>
    );
};

export default LoginPage;