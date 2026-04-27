// src/pages/DrawPage.jsx
import React, { useRef } from 'react';
import { HiSparkles } from 'react-icons/hi2';

// Dynamically import Excalidraw since it doesn't support SSR
const ExcalidrawWrapper = React.lazy(() => import('../components/ExcalidrawWrapper'));

const DrawPage = () => {
    const excalidrawRef = useRef(null);

    return (
        <div className="w-full bg-aida-light" style={{ position: 'absolute', inset: 0 }}>
            {/* Excalidraw Component taking the full screen */}
            <div className="absolute inset-0">
                <React.Suspense fallback={
                    <div className="absolute inset-0 flex items-center justify-center bg-aida-light">
                        <div className="animate-pulse text-aida-text-muted flex flex-col items-center">
                            <HiSparkles className="w-8 h-8 text-aida-pink mb-2" />
                            Loading Canvas...
                        </div>
                    </div>
                }>
                    <ExcalidrawWrapper ref={excalidrawRef} />
                </React.Suspense>
            </div>
        </div>
    );
};

export default DrawPage;