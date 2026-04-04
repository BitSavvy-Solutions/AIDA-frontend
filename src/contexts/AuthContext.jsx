// src/contexts/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { buildUrl, getRequestOptions } from '../config/apiConfig';

// REMOVED: import userService from '../services/userService';
// processLogin no longer needs userService. The new backend /auth/google
// handles both user creation and token generation in one call.

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [apiToken, setApiToken] = useState(null);     // NEW: API token state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    // Wipes all auth state from memory and localStorage in one go.
    // Called on logout and on failed login to prevent partial state.
    const clearAuthState = useCallback(() => {
        setUser(null);
        setApiToken(null);
        setIsAuthenticated(false);
        localStorage.removeItem('aidaUser');
        localStorage.removeItem('aidaToken');
        localStorage.removeItem('aidaTokenExpiry');
    }, []);

    // CHANGED: processLogin now accepts a Google ID token string (credential)
    // from the GoogleLogin component, not a googleData object.
    // It calls POST /auth/google which returns a secure aitut_sk_ API token.
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

            // Store all three pieces so we can restore and validate the session on refresh
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

    // CHANGED: logout is now synchronous from the UI's perspective.
    // It clears local state immediately (instant UI response) and then
    // fires the backend deactivation call as fire-and-forget.
    // This means Header.jsx can call logout(); navigate('/'); without awaiting.
    const logout = useCallback(() => {
        // Capture token BEFORE clearing storage, because we need it for the backend call
        const tokenToDeactivate = localStorage.getItem('aidaToken');

        // Clear local state first so the UI responds immediately
        clearAuthState();
        console.log('🚪 User logged out.');

        // Notify backend asynchronously - best effort, non-critical
        // If this fails, the token expires naturally in 7 days anyway
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

    // CHANGED: On app load, we now restore THREE things (user, token, expiry)
    // and proactively check if the token has expired BEFORE the user does anything.
    // If expired, we clear the session silently. The user sees the login button,
    // not a 401 error mid-conversation.
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('aidaUser');
            const storedToken = localStorage.getItem('aidaToken');
            const storedExpiry = localStorage.getItem('aidaTokenExpiry');

            if (storedUser && storedToken && storedExpiry) {
                const expiresAt = new Date(storedExpiry);

                if (new Date() >= expiresAt) {
                    // Token is expired, clear everything before user interacts
                    console.log('🔒 Stored token has expired. Clearing session silently.');
                    clearAuthState();
                } else {
                    // Token is still valid, restore the full session
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
        apiToken,           // NEW: exposed so AidaWidget and other components can use it
        isAuthenticated,
        authLoading,
        processLogin,
        logout
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};