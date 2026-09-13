// src/contexts/ProfileLauncherContext.jsx

import React, { createContext, useContext, useState, useCallback } from 'react';
import BetaAgreementModal from '../components/BetaAgreementModal';
import ProfileWizard from '../components/ProfileWizard';

const ProfileLauncherCtx = createContext(null);

export const useProfileLauncher = () => {
    const ctx = useContext(ProfileLauncherCtx);
    if (!ctx) {
        throw new Error('useProfileLauncher must be used inside <ProfileLauncherProvider>');
    }
    return ctx;
};

export const ProfileLauncherProvider = ({ children, isAuthenticated }) => {
    const [wizardOpen, setWizardOpen] = useState(false);
    const [betaOpen, setBetaOpen] = useState(false);

    // Check localStorage once when the component mounts
    const [hasAgreed, setHasAgreed] = useState(() => {
        return localStorage.getItem('aida-beta-agreed') === 'true';
    });

    const requestCreateProfile = useCallback(() => {
        if (!isAuthenticated) return;
        if (hasAgreed) {
            setWizardOpen(true);
        } else {
            setBetaOpen(true);
        }
    }, [isAuthenticated, hasAgreed]);

    const handleAgree = useCallback(() => {
        localStorage.setItem('aida-beta-agreed', 'true');
        setHasAgreed(true);
        setBetaOpen(false);
        setWizardOpen(true);
    }, []);

    return (
        <ProfileLauncherCtx.Provider value={{ requestCreateProfile }}>
            {children}

            <BetaAgreementModal
                isOpen={betaOpen}
                onClose={() => setBetaOpen(false)}
                onAgree={handleAgree}
            />

            <ProfileWizard
                isOpen={wizardOpen}
                onClose={() => setWizardOpen(false)}
            />
        </ProfileLauncherCtx.Provider>
    );
};