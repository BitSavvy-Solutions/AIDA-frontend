// src/components/PWAInstallBanner.jsx
import React, { useEffect, useState } from 'react';
import { HiSparkles } from 'react-icons/hi2';
import { FiDownload, FiShare, FiX } from 'react-icons/fi';

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;

const PWAInstallBanner = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (localStorage.getItem('pwa-banner-dismissed')) return;

        // iOS: show manual instructions if not already installed
        if (isIOS && !isInStandaloneMode) {
            setIsVisible(true);
            return;
        }

        // Android/Desktop: use native browser install prompt
        if (window.__pwaPrompt) {
            setDeferredPrompt(window.__pwaPrompt);
            setIsVisible(true);
        }

        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            window.__pwaPrompt = e;
            setDeferredPrompt(e);
            setIsVisible(true);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA install ${outcome}`);
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    const handleDismiss = () => {
        localStorage.setItem('pwa-banner-dismissed', '1');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="sticky top-20 z-40 flex justify-center px-4 pointer-events-none">
            <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm pointer-events-auto">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-aida-pink to-pink-600 flex items-center justify-center">
                    <HiSparkles className="w-5 h-5 text-white" />
                </div>

                {isIOS ? (
                    <div className="flex-grow min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Install AIDA</p>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Tap <FiShare className="inline w-3 h-3 mb-0.5" /> then
                            <span className="font-medium"> "Add to Home Screen"</span>
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="flex-grow min-w-0">
                            <p className="text-sm font-semibold text-gray-900">Install AIDA</p>
                            <p className="text-xs text-gray-500 truncate">Add to home screen for quick access</p>
                        </div>
                        <button
                            onClick={handleInstall}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-aida-pink text-white text-sm font-medium rounded-lg hover:bg-pink-600 transition-colors"
                        >
                            <FiDownload className="w-3.5 h-3.5" />
                            Install
                        </button>
                    </>
                )}

                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Dismiss"
                >
                    <FiX className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default PWAInstallBanner;
