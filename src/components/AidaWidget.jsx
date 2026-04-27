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
                            getPageContext: async () => {
                                console.log("[AIDA] Extracting page context...");
                                
                                let textContent = "";
                                let fileName = `${document.title || 'AIDA Page'} Context.txt`;

                                // 1. Check if we are on the Draw page and Excalidraw is active
                                if (window.excalidrawAPI) {
                                    console.log("[AIDA] Excalidraw detected, extracting raw JSON content...");
                                    
                                    // Get elements, filter out deleted ones and images to save tokens
                                    const elements = window.excalidrawAPI.getSceneElements()
                                        .filter(el => !el.isDeleted && el.type !== 'image');
                                    
                                    const appState = window.excalidrawAPI.getAppState();

                                    // Construct the exact JSON structure of an .excalidraw file
                                    const excalidrawJSON = {
                                        type: "excalidraw",
                                        version: 2,
                                        source: "https://excalidraw.com",
                                        elements: elements,
                                        appState: {
                                            gridSize: appState.gridSize || 20,
                                            gridStep: appState.gridStep || 5,
                                            gridModeEnabled: appState.gridModeEnabled || false,
                                            viewBackgroundColor: appState.viewBackgroundColor || "#ffffff",
                                            lockedMultiSelections: {}
                                        },
                                        files: {} // Keep files empty as requested
                                    };

                                    // Convert to formatted JSON string
                                    textContent = JSON.stringify(excalidrawJSON, null, 2);
                                    fileName = "Excalidraw_Canvas.json"; // Use .json so the AI parses it correctly
                                } 
                                // 2. Fallback to standard DOM extraction for other pages
                                else {
                                    const contentElement = document.querySelector('main') || document.body;
                                    textContent = contentElement.innerText;
                                }
                                
                                return {
                                    name: fileName,
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