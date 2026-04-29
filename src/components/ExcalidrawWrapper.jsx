// src/components/ExcalidrawWrapper.jsx
import React, { useImperativeHandle, forwardRef, useState, useEffect, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

// --- Native IndexedDB Helpers for Persistence ---
const DB_NAME = 'AidaDrawDB';
const STORE_NAME = 'draw_state';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveToDB = async (data) => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(data, 'latest_state');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB save error:", err);
  }
};

const loadFromDB = async () => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get('latest_state');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB load error:", err);
    return null;
  }
};
// ------------------------------------------------

const ExcalidrawWrapper = forwardRef((props, ref) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const saveTimeoutRef = useRef(null);
  
  // This enables us to access excalidrawAPI from the parent component using ref
  useImperativeHandle(ref, () => ({
    getApi: () => excalidrawAPI
  }));

  // Expose the API globally so the AIDA widget can extract text from the canvas
  useEffect(() => {
    if (excalidrawAPI) {
      window.excalidrawAPI = excalidrawAPI;
    }
    // Cleanup when the user navigates away from the draw page
    return () => {
      window.excalidrawAPI = null;
    };
  }, [excalidrawAPI]);

  // Load saved state from IndexedDB on mount
  useEffect(() => {
    const loadState = async () => {
      const savedState = await loadFromDB();
      if (savedState) {
        setInitialData(savedState);
      } else {
        // Fallback to empty if nothing is saved yet
        setInitialData({ elements: [], appState: {}, files: {} });
      }
      setIsReady(true);
    };
    loadState();
  }, []);

  // Handle canvas changes and save to IndexedDB
  const handleChange = (elements, appState, files) => {
    // Clear the previous timeout to debounce the save operation
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Wait 1 second after the user stops drawing/zooming to save (prevents lag)
    saveTimeoutRef.current = setTimeout(() => {
      // Filter out deleted elements to save storage space
      const activeElements = elements.filter(el => !el.isDeleted);
      
      const stateToSave = {
        elements: activeElements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
          theme: appState.theme,
          // Added zoom and scroll properties to preserve viewport
          zoom: appState.zoom,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
        },
        files: files // Crucial for keeping pasted images!
      };
      
      saveToDB(stateToSave);
    }, 1000);
  };

  // Don't render Excalidraw until we've loaded the initial data, 
  // otherwise it will render empty and immediately overwrite our saved state.
  if (!isReady) {
    return null; 
  }

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={initialData}
        onChange={handleChange}
        {...props}
      />
    </div>
  );
});

ExcalidrawWrapper.displayName = "ExcalidrawWrapper";

export default ExcalidrawWrapper;