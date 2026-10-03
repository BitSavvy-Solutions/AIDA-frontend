// src/contexts/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { buildUrl, getRequestOptions } from '../config/apiConfig';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [apiToken, setApiToken] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    // Wipes all auth state from memory and localStorage in one go.
    const clearAuthState = useCallback(() => {
        setUser(null);
        setApiToken(null);
        setIsAuthenticated(false);
        localStorage.removeItem('aidaUser');
        localStorage.removeItem('aidaToken');
        localStorage.removeItem('aidaTokenExpiry');
        localStorage.removeItem('aida-active-profile'); // ADDED: clear active profile on logout
    }, []);

    const processLogin = useCallback(async (credential) => {
        setAuthLoading(true);
        try {
            const url = buildUrl('/auth/google');
            const baseOptions = getRequestOptions();

            const response = await fetch(url, {
                method: 'POST',
                headers: baseOptions.headers,
                signal: baseOptions.signal,
                body: JSON.stringify({ idToken: credential })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Authentication failed. Please try again.');
            }

            const finalUser = {
                id: data.user.userId,
                email: data.user.email,
                name: data.user.name,
                picture: data.user.profilePictureUrl,
            };

            setUser(finalUser);
            setApiToken(data.token);
            setIsAuthenticated(true);

            localStorage.setItem('aidaUser', JSON.stringify(finalUser));
            localStorage.setItem('aidaToken', data.token);
            localStorage.setItem('aidaTokenExpiry', data.expiresAt);

            console.log('✅ Login successful.', finalUser.email);
        } catch (error) {
            console.error('❌ Auth processing error:', error.message);
            clearAuthState();
            throw error;
        } finally {
            setAuthLoading(false);
        }
    }, [clearAuthState]);

    const logout = useCallback(() => {
        const tokenToDeactivate = localStorage.getItem('aidaToken');

        clearAuthState();
        console.log('🚪 User logged out.');

        if (tokenToDeactivate) {
            const url = buildUrl('/auth/logout');
            const options = getRequestOptions();
            fetch(url, {
                method: 'POST',
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${tokenToDeactivate}`
                }
            }).catch(e => console.warn('Backend logout notification failed (non-critical):', e.message));
        }
    }, [clearAuthState]);

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('aidaUser');
            const storedToken = localStorage.getItem('aidaToken');
            const storedExpiry = localStorage.getItem('aidaTokenExpiry');

            if (storedUser && storedToken && storedExpiry) {
                const expiresAt = new Date(storedExpiry);

                if (new Date() >= expiresAt) {
                    console.log('🔒 Stored token has expired. Clearing session silently.');
                    clearAuthState();
                } else {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    setApiToken(storedToken);
                    setIsAuthenticated(true);
                    console.log('🔄 Session restored:', parsedUser.email);
                }
            }
        } catch (error) {
            console.error('Failed to restore session:', error);
            clearAuthState();
        } finally {
            setAuthLoading(false);
        }
    }, [clearAuthState]);

    const value = {
        user,
        apiToken,
        isAuthenticated,
        authLoading,
        processLogin,
        logout
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};