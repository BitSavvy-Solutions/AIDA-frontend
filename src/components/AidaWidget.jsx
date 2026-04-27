// src/components/AidaWidget.jsx

import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const WIDGET_CONTAINER_ID = 'aida-global-widget-container';

const AidaWidget = () => {
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
                            // ✅ NEW: Added getPageContext to read the current page
                            getPageContext: async () => {
                                console.log("[AIDA] Extracting page context...");
                                
                                // Grab the main content area to avoid header/footer noise
                                // Fallback to document.body if <main> doesn't exist
                                const contentElement = document.querySelector('main') || document.body;
                                const textContent = contentElement.innerText;
                                
                                // Use the document title for the attachment name
                                const pageTitle = document.title || 'AIDA Page';
                                
                                return {
                                    name: `${pageTitle} Context.txt`,
                                    content: textContent
                                };
                            },
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

    }, [isAuthenticated, user, authLoading, apiToken]);

    return null;
};

export default AidaWidget;