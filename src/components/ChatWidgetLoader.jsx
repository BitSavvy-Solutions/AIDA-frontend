import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ChatWidgetLoader = () => {
    const { user, isAuthenticated, authLoading } = useAuth();

    useEffect(() => {
        // Only render if auth state is settled and widget is available
        if (!authLoading && window.AidaWidget) {
            let widgetUser = { email: 'demo@example.com', name: 'Guest' };

            if (isAuthenticated && user) {
                console.log(`[AIDA] Rendering widget for authenticated user: ${user.id}`);
                widgetUser = {
                    id: user.id, // The essential persistent ID from your backend
                    email: user.email,
                    name: user.name,
                };
            } else {
                console.log('[AIDA] Rendering widget for anonymous user.');
            }

            // Render the widget with the appropriate user object
            window.AidaWidget.render("#aida-widget-container", {
                language: 'en',
                user: widgetUser,
                translations: {
                    transcribing: 'Transcribing...',
                    inputPlaceholder: 'Type a message to Aida...'
                },
            });
        }

        // Cleanup function to destroy the widget on component unmount
        return () => {
            if (window.AidaWidget && window.AidaWidget.destroy) {
                const container = document.getElementById('aida-widget-container');
                if (container && container.innerHTML) {
                    console.log('[AIDA] Destroying widget instance.');
                    window.AidaWidget.destroy("#aida-widget-container");
                }
            }
        };
    }, [isAuthenticated, user, authLoading]); // Rerender if auth state changes

    if (authLoading) {
        return (
            <div className="h-full min-h-[600px] bg-gray-200 rounded-lg animate-pulse flex items-center justify-center">
                <p className="text-gray-500">Initializing AIDA...</p>
            </div>
        )
    }

    return (
        <div id="aida-widget-container" className="rounded-2xl shadow-2xl border bg-white overflow-hidden h-full min-h-[70vh]">
            {/* The AIDA Widget will be rendered here by its script */}
        </div>
    );
};

export default ChatWidgetLoader;