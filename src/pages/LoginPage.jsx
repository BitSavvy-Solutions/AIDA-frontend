/* src/pages/LoginPage.jsx */
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

    // This effect is now ONLY to redirect an already-logged-in user
    // who happens to land on the /login page. It no longer interferes
    // with the post-login navigation flow.
    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            console.log('User is already authenticated. Redirecting from login page.');
            navigate('/', { replace: true });
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
                
                // This function now exclusively controls the post-login redirect.
                await processLogin({
                    id: userInfo.id,
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    provider: 'google'
                });

                navigate('/', { replace: true }); // Redirect to home page after login
            } catch (err) {
                console.error("Google login process failed:", err);
                setError('Failed to process login. Please try again.');
            }
        },
        onError: () => {
            setError('Google authentication failed. Please try again.');
        },
    });

    // If the user is already logged in, we can show a loading/redirecting state
    // instead of the login form while the effect redirects them.
    if (authLoading || isAuthenticated) {
        return (
            <div className="flex items-center justify-center py-12 px-4">
                <p className="text-aida-text-muted">Redirecting...</p>
            </div>
        );
    }
    
    return (
        <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md p-8 space-y-8 bg-aida-card rounded-xl shadow-lg border border-aida-border">
                <div className="text-center">
                    <FiLogIn className="mx-auto h-12 w-12 text-aida-pink" />
                    <h2 className="mt-6 text-3xl font-bold text-aida-dark">Sign in to AIDA</h2>
                    <p className="mt-2 text-sm text-aida-text-muted">to save conversations and track usage</p>
                </div>
                
                {error && (
                    <div className="bg-red-200/20 border border-red-400 text-red-300 px-4 py-3 rounded-lg relative flex items-center">
                        <FiAlertCircle className="mr-2"/>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}
                
                <button
                    onClick={() => handleGoogleLogin()}
                    disabled={authLoading} // Although we render "Redirecting", this is still good practice
                    className="w-full flex items-center justify-center px-4 py-3 border border-aida-border rounded-md shadow-sm text-base font-medium text-aida-dark bg-aida-light hover:bg-opacity-80 disabled:opacity-50 transition-colors"
                >
                    <FcGoogle className="w-6 h-6 mr-3" />
                    Sign in with Google
                </button>
            </div>
        </div>
    );
};

export default LoginPage;