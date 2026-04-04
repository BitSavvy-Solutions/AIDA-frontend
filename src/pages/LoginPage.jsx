// src/pages/LoginPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
// CHANGED: useGoogleLogin -> GoogleLogin
// useGoogleLogin only returns an access_token. Our backend needs a Google ID token
// to cryptographically verify the user. GoogleLogin component's onSuccess callback
// provides credentialResponse.credential which IS the Google ID token.
import { useAuth } from '../contexts/AuthContext';
import { FiLogIn, FiAlertCircle } from 'react-icons/fi';
// REMOVED: FcGoogle import. No longer needed since we use the GoogleLogin component.

const LoginPage = () => {
    const [error, setError] = useState('');
    const { processLogin, isAuthenticated, authLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            console.log('User is already authenticated. Redirecting from login page.');
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, authLoading, navigate]);

    // CHANGED: handleGoogleLogin -> handleCredentialResponse
    // credentialResponse.credential is the Google ID token string.
    // We pass it directly to processLogin which sends it to our backend for verification.
    const handleCredentialResponse = async (credentialResponse) => {
        setError('');

        if (!credentialResponse?.credential) {
            setError('Could not retrieve Google credentials. Please try again.');
            return;
        }

        try {
            await processLogin(credentialResponse.credential);
            navigate('/', { replace: true });
        } catch (err) {
            console.error("Google login process failed:", err);
            setError(err.message || 'Failed to process login. Please try again.');
        }
    };

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
                        <FiAlertCircle className="mr-2" />
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                {/* CHANGED: Replaced custom FcGoogle button with GoogleLogin component.
                    The GoogleLogin component is the only way to get a Google ID token
                    on the frontend without a backend OAuth code exchange. */}
                <div className="flex justify-center">
                    <GoogleLogin
                        onSuccess={handleCredentialResponse}
                        onError={() => setError('Google authentication failed. Please try again.')}
                        useOneTap={false}
                        theme="outline"
                        size="large"
                        text="signin_with"
                        shape="rectangular"
                        width="368"
                    />
                </div>
            </div>
        </div>
    );
};

export default LoginPage;