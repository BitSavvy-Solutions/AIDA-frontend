// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

import { googleConfig } from './config/authConfig';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ProfileSyncProvider } from './contexts/ProfileSyncContext';
import { ProfileLauncherProvider } from './contexts/ProfileLauncherContext';

import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SourcePage from './pages/SourcePage';
import DrawPage from './pages/DrawPage';
import AidaWidget from './components/AidaWidget';
import Account from './pages/Account';

const AppContent = () => {
    const { isAuthenticated, authLoading } = useAuth();

    return (
        <ProfileLauncherProvider isAuthenticated={isAuthenticated}>
            <Router>
                <>
                    <Routes>
                        <Route path="/draw" element={<DrawPage />} />
                        <Route path="/*" element={
                            <div className="min-h-screen flex flex-col bg-aida-light">
                                <Header />
                                <main className="flex-grow">
                                    <Routes>
                                        <Route path="/"        element={<HomePage />} />
                                        <Route path="/login"   element={<LoginPage />} />
                                        <Route path="/source"  element={<SourcePage />} />
                                        <Route path="/account" element={<Account />} />
                                        <Route path="*"        element={<Navigate to="/" replace />} />
                                    </Routes>
                                </main>
                                <Footer />
                            </div>
                        } />
                    </Routes>

                    <div id="aida-global-widget-container" className="fixed bottom-5 right-5 z-[1000]" />
                    {!authLoading && (
                        <AidaWidget key={isAuthenticated ? 'authenticated' : 'anonymous'} />
                    )}
                </>
            </Router>
        </ProfileLauncherProvider>
    );
};

function App() {
    return (
        <GoogleOAuthProvider clientId={googleConfig.clientId}>
            <AuthProvider>
                <ProfileProvider>
                    <ProfileSyncProvider>
                        <AppContent />
                    </ProfileSyncProvider>
                </ProfileProvider>
            </AuthProvider>
        </GoogleOAuthProvider>
    );
}

export default App;