// src/pages/DrawPage.jsx
import React, { useState, useRef, useCallback } from 'react';
import { FiDownload, FiSave, FiUpload, FiArrowLeft } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { Link } from 'react-router-dom';

// Dynamically import Excalidraw since it doesn't support SSR
const ExcalidrawWrapper = React.lazy(() => import('../components/ExcalidrawWrapper'));

const DrawPage = () => {
    const [isExporting, setIsExporting] = useState(false);
    const excalidrawRef = useRef(null);

    const handleExportToImage = useCallback(async () => {
        if (!excalidrawRef.current) return;
        setIsExporting(true);
        
        try {
            const excalidrawAPI = excalidrawRef.current.getApi();
            if (!excalidrawAPI) return;

            // Dynamically import the export utility
            const { exportToBlob } = await import("@excalidraw/excalidraw");
            
            const elements = excalidrawAPI.getSceneElements();
            const appState = excalidrawAPI.getAppState();

            const blob = await exportToBlob({
                elements,
                appState,
                mimeType: "image/png",
                exportWithBackground: true,
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `aida-drawing-${new Date().toISOString().slice(0, 10)}.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error exporting drawing:", error);
        } finally {
            setIsExporting(false);
        }
    }, []);

    const handleSaveToJSON = useCallback(async () => {
        if (!excalidrawRef.current) return;
        
        const excalidrawAPI = excalidrawRef.current.getApi();
        if (!excalidrawAPI) return;

        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        
        const data = JSON.stringify({ elements, appState });
        
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `aida-drawing-${new Date().toISOString().slice(0, 10)}.excalidraw`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    const handleFileUpload = useCallback((event) => {
        const file = event.target.files[0];
        if (!file || !excalidrawRef.current) return;
        
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const json = JSON.parse(reader.result);
                const excalidrawAPI = excalidrawRef.current.getApi();
                if (excalidrawAPI) {
                    excalidrawAPI.updateScene(json);
                }
            } catch (error) {
                console.error("Error parsing file:", error);
                alert("Invalid Excalidraw file");
            }
        };
        reader.readAsText(file);
        event.target.value = null;
    }, []);

    return (
        // Remove h-screen class and use min-h-screen instead
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

            {/* Floating action buttons for export/save/open */}
            <div className="absolute bottom-6 right-6 flex flex-col gap-3 z-10">
                <button
                    onClick={handleExportToImage}
                    disabled={isExporting}
                    className="p-3 rounded-full bg-white border border-gray-200 text-gray-700 shadow-lg hover:bg-gray-50 transition-colors"
                    title="Export as PNG"
                >
                    <FiDownload className="w-5 h-5" />
                </button>
                <button
                    onClick={handleSaveToJSON}
                    className="p-3 rounded-full bg-white border border-gray-200 text-gray-700 shadow-lg hover:bg-gray-50 transition-colors"
                    title="Save File"
                >
                    <FiSave className="w-5 h-5" />
                </button>
                <label className="p-3 rounded-full bg-white border border-gray-200 text-gray-700 shadow-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <FiUpload className="w-5 h-5" />
                    <input
                        type="file"
                        accept=".excalidraw,.json"
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                </label>
            </div>

            {/* Home button to return to main app */}
            <Link 
                to="/" 
                className="absolute top-6 left-6 p-3 rounded-full bg-white border border-gray-200 text-gray-700 shadow-lg hover:bg-gray-50 transition-colors z-10"
                title="Back to home"
            >
                <FiArrowLeft className="w-5 h-5" />
            </Link>
        </div>
    );
};

export default DrawPage;