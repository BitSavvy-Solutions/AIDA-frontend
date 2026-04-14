// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

import { googleConfig } from './config/authConfig';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SourcePage from './pages/SourcePage';       // ← new
import AidaWidget from './components/AidaWidget';
import Account from './pages/Account';

/**
 * AppContent uses hooks from providers that wrap it, and owns the
 * global layout (header → main → footer) plus the persistent widget.
 */
const AppContent = () => {
    const { isAuthenticated, authLoading } = useAuth();

    return (
        <Router>
            <div className="min-h-screen flex flex-col bg-aida-light">
                <Header />

                <main className="flex-grow">
                    <Routes>
                        <Route path="/"       element={<HomePage />} />
                        <Route path="/login"  element={<LoginPage />} />
                        <Route path="/source" element={<SourcePage />} />  {/* ← new */}
                        <Route path="/account" element={<Account />} />  {/* ← new */}
                        <Route path="*"       element={<Navigate to="/" replace />} />
                    </Routes>
                </main>

                <Footer />

                {/* Global fixed container — the widget script renders its UI here */}
                <div
                    id="aida-global-widget-container"
                    className="fixed bottom-5 right-5 z-[1000]"
                />

                {/*
                  Widget controller. Keyed on auth state so React unmounts/remounts
                  it on login/logout, causing the widget to re-render with the correct
                  user context without a full page reload.
                */}
                {!authLoading && (
                    <AidaWidget key={isAuthenticated ? 'authenticated' : 'anonymous'} />
                )}
            </div>
        </Router>
    );
};

function App() {
    return (
        <GoogleOAuthProvider clientId={googleConfig.clientId}>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </GoogleOAuthProvider>
    );
}

export default App;