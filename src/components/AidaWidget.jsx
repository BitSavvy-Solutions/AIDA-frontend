/* src/components/AidaWidget.jsx */
import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Define a constant for the global widget container ID
const WIDGET_CONTAINER_ID = 'aida-global-widget-container';

/**
 * A controller component that manages the lifecycle of the global AIDA widget.
 * It does not render any DOM itself but imperatively calls the widget's render function.
 */
const AidaWidget = () => {
    const { user, isAuthenticated, authLoading } = useAuth();

    useEffect(() => {
        // This effect runs once per component instance. The `key` prop in App.jsx
        // ensures a fresh instance on authentication state changes.
        if (authLoading || typeof window.AidaWidget === 'undefined') {
            // Wait for auth to be resolved and the widget script to be loaded.
            return;
        }

        let widgetUser = { email: 'demo@example.com', name: 'Guest' };

        if (isAuthenticated && user) {
            console.log(`[AIDA] Rendering universal widget for AUTHENTICATED user: ${user.id}`);
            widgetUser = {
                id: user.id,
                email: user.email,
                name: user.name,
            };
        } else {
            console.log('[AIDA] Rendering universal widget for ANONYMOUS user.');
        }

        const container = document.getElementById(WIDGET_CONTAINER_ID);

        if (container) {
            // A small delay helps ensure all scripts are settled before rendering.
            const timer = setTimeout(() => {
                try {
                    // Render the widget into the predefined global container.
                    window.AidaWidget.render(`#${WIDGET_CONTAINER_ID}`, {
                        language: 'en',
                        user: widgetUser,
                        translations: {
                            transcribing: 'Transcribing...',
                            inputPlaceholder: 'Type a message to Aida...'
                        },
                        features: {
                            resizable: true,
                            modelSelection: true,
                            voiceInput: true,
                            webSearch: true,
                            imageUpload: true,
                            retryMessage: true,
                            customInstructions: true,
                            historyProjects: true,
                            paymentLink: {
                                show: true,
                                url: 'https://buy.stripe.com/5kQ8wO11A3y97tjcThabK00',
                                text: '' // Custom text for dev environment
                            }
                        }
                    });
                    console.log('[AIDA] Universal widget successfully rendered.');
                } catch (e) {
                    console.error('[AIDA] Failed to render universal widget:', e);
                }
            }, 50); // Small delay for safety

            // Cleanup the timer on component unmount
            return () => clearTimeout(timer);
        } else {
            console.warn(`[AIDA] Global widget container #${WIDGET_CONTAINER_ID} not found.`);
        }

    }, [isAuthenticated, user, authLoading]); // Effect dependencies

    // This component is a "controller" and renders nothing itself.
    return null;
};

export default AidaWidget;