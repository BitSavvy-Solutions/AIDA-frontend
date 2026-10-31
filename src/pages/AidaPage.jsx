// src/components/AidaWidget.jsx

import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createPkbMemoryAdapter } from '../services/pkbMemoryAdapter';

const WIDGET_CONTAINER_ID = 'aida-global-widget-container';

const AidaWidget = () => {
    const { user, isAuthenticated, authLoading, apiToken } = useAuth();

    useEffect(() => {
        if (authLoading || typeof window.AidaWidget === 'undefined') {
            return;
        }

        // The adapter is created inside the effect (not useMemo) so its
        // database subscriptions are always paired with a cleanup.
        const memoryAdapter = createPkbMemoryAdapter();

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

        if (!container) {
            console.warn(`[AIDA] Container #${WIDGET_CONTAINER_ID} not found.`);
            memoryAdapter.dispose();
            return;
        }

        const timer = setTimeout(() => {
            try {
                window.AidaWidget.render(`#${WIDGET_CONTAINER_ID}`, {
                    language: 'en',
                    user: widgetUser,
                    memoryAdapter,
                    historyUrl: '/pkb',
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

                                const elements = window.excalidrawAPI.getSceneElements()
                                    .filter(el => !el.isDeleted && el.type !== 'image');

                                const appState = window.excalidrawAPI.getAppState();

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
                                    files: {}
                                };

                                textContent = JSON.stringify(excalidrawJSON, null, 2);
                                fileName = "Excalidraw_Canvas.json";
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
                            url: '/account',
                            text: '',
                        }
                    }
                });
                console.log('[AIDA] Widget rendered successfully.');
            } catch (e) {
                console.error('[AIDA] Failed to render widget:', e);
            }
        }, 50);

        return () => {
            clearTimeout(timer);
            // Best-effort unmount: older widget bundles may not expose an
            // unmount API, in which case re-rendering behaves exactly as
            // before. Adapter disposal below is safe regardless because
            // its data methods keep working after dispose().
            try {
                if (typeof window.AidaWidget?.unmount === 'function') {
                    window.AidaWidget.unmount(`#${WIDGET_CONTAINER_ID}`);
                }
            } catch (e) {
                console.warn('[AIDA] Widget unmount failed:', e);
            }
            memoryAdapter.dispose();
        };
    }, [isAuthenticated, user, authLoading, apiToken]);

    return null;
};

export default AidaWidget;