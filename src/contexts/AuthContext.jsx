import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import userService from '../services/userService';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    // This function is called by the LoginPage after a successful Google login.
    const processLogin = useCallback(async (googleData) => {
        setAuthLoading(true);
        try {
            const result = await userService.registerOrLoginUser(googleData);
            
            if (result.success && result.user) {
                // The crucial user object from YOUR backend
                const finalUser = {
                    id: result.user.userId, // This is the persistent ID for API calls
                    email: result.user.email,
                    name: result.user.name,
                    picture: result.user.profilePictureUrl,
                };
                
                setUser(finalUser);
                setIsAuthenticated(true);
                localStorage.setItem('aidaUser', JSON.stringify(finalUser));
                console.log(`✅ ${result.message}`, finalUser);
            } else {
                throw new Error(result.message || "An unknown error occurred during login.");
            }
        } catch (error) {
            console.error("❌ Auth processing error:", error.message);
            // Ensure we are fully logged out on failure
            logout();
            // Optionally, re-throw the error if you want the UI to handle it
            throw error;
        } finally {
            setAuthLoading(false);
        }
    }, []);

    // Function to log the user out
    const logout = useCallback(() => {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('aidaUser');
        console.log('🚪 User logged out.');
    }, []);

    // On initial app load, check if a user is saved in localStorage
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('aidaUser');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                setIsAuthenticated(true);
                console.log('🔄 Restored user session from localStorage:', parsedUser);
            }
        } catch (error) {
            console.error("Failed to parse stored user data:", error);
            // Clear bad data from storage
            localStorage.removeItem('aidaUser');
        } finally {
            setAuthLoading(false);
        }
    }, []);

    const value = {
        user,
        isAuthenticated,
        authLoading,
        processLogin,
        logout
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};