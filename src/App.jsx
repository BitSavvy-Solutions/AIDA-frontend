import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

import { googleConfig } from './config/authConfig';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import AidaWidget from './components/AidaWidget'; // Import the new widget controller

/**
 * This component contains the main layout and allows us to use hooks
 * from providers that wrap it.
 */
const AppContent = () => {
  const { isAuthenticated, authLoading } = useAuth();
  
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-aida-light">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
        
        {/* 1. Global, fixed-position container for the AIDA widget */}
        <div id="aida-global-widget-container" className="fixed bottom-5 right-5 z-[1000]">
           {/* The AIDA widget script will render its UI inside this div */}
        </div>

        {/* 
          2. The AidaWidget controller component.
          We give it a key that changes on auth status. This forces React
          to unmount the old component and mount a new one, triggering its
          useEffect and re-rendering the AIDA widget with the correct user context.
        */}
        {!authLoading && <AidaWidget key={isAuthenticated ? 'authenticated' : 'anonymous'} />}
      </div>
    </Router>
  );
}

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