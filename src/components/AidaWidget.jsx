// src/components/AidaWidget.jsx

import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const WIDGET_CONTAINER_ID = 'aida-global-widget-container';

const AidaWidget = () => {
    // CHANGED: Added apiToken to the destructured context values
    const { user, isAuthenticated, authLoading, apiToken } = useAuth();

    useEffect(() => {
        if (authLoading || typeof window.AidaWidget === 'undefined') {
            return;
        }

        let widgetUser = { email: 'demo@example.com', name: 'Guest' };

        if (isAuthenticated && user) {
            console.log(`[AIDA] Rendering widget for authenticated user: ${user.id}`);
            widgetUser = {
                id: user.id,
                email: user.email,
                name: user.name,
                // CHANGED: Pass the API token so the widget can include it in
                // its Authorization header when calling /iverse_agent.
                // The widget's own backend calls will need to be updated
                // separately to use this token in the header.
                apiToken: apiToken || null,
            };
        } else {
            console.log('[AIDA] Rendering widget for anonymous user.');
        }

        const container = document.getElementById(WIDGET_CONTAINER_ID);

        if (container) {
            const timer = setTimeout(() => {
                try {
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
                                text: ''
                            }
                        }
                    });
                    console.log('[AIDA] Widget rendered successfully.');
                } catch (e) {
                    console.error('[AIDA] Failed to render widget:', e);
                }
            }, 50);

            return () => clearTimeout(timer);
        } else {
            console.warn(`[AIDA] Container #${WIDGET_CONTAINER_ID} not found.`);
        }

    // CHANGED: Added apiToken to dependency array so the widget
    // re-renders with the new token immediately after login
    }, [isAuthenticated, user, authLoading, apiToken]);

    return null;
};

export default AidaWidget;