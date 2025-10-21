import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ChatWidgetLoader = () => {
    // We still need user/auth state to know *what* to render
    const { user, isAuthenticated, authLoading } = useAuth();

    useEffect(() => {
        // Because of the `key` prop, this effect runs once on mount for a clean component.
        // It will run again only if the component is completely re-mounted.

        if (authLoading || !window.AidaWidget) {
            return;
        }

        let widgetUser = { email: 'demo@example.com', name: 'Guest' };

        if (isAuthenticated && user) {
            console.log(`[AIDA] Rendering widget for AUTHENTICATED user: ${user.id}`);
            widgetUser = {
                id: user.id,
                email: user.email,
                name: user.name,
            };
        } else {
            console.log('[AIDA] Rendering widget for ANONYMOUS user.');
        }

        const container = document.getElementById('aida-widget-container');

        if (container) {
             // A small delay can help ensure all scripts are settled
            const timer = setTimeout(() => {
                try {
                    window.AidaWidget.render("#aida-widget-container", {
                        language: 'en',
                        user: widgetUser,
                        translations: {
                            transcribing: 'Transcribing...',
                            inputPlaceholder: 'Type a message to Aida...'
                        },
                    });
                     console.log('[AIDA] Widget successfully rendered.');
                } catch(e) {
                    console.error('[AIDA] Failed to render widget:', e);
                }
            }, 50); // Small delay for safety

            // No cleanup needed because the parent div will be destroyed by React
            return () => clearTimeout(timer);
        }

    }, [isAuthenticated, user, authLoading]); // Dependencies are correct

    if (authLoading) {
        return (
            <div className="h-full min-h-[600px] w-full bg-gray-800/50 rounded-lg animate-pulse flex items-center justify-center">
                <p className="text-gray-400">Initializing AIDA...</p>
            </div>
        );
    }

    // The container now lives here. It gets created and destroyed with the component.
    return (
        <div 
            id="aida-widget-container"
            className="min-h-[600px] w-full"
        >
            {/* The AIDA Widget will be rendered here by its script */}
        </div>
    );
};

export default ChatWidgetLoader;