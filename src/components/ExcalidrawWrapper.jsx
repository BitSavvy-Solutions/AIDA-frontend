// src/components/ExcalidrawWrapper.jsx
import React, { useImperativeHandle, forwardRef, useState, useEffect } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

const ExcalidrawWrapper = forwardRef((props, ref) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  
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

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        // We completely removed UIOptions. 
        // Excalidraw will now use its safe defaults, which includes the Save/Export buttons!
        {...props}
      />
    </div>
  );
});

ExcalidrawWrapper.displayName = "ExcalidrawWrapper";

export default ExcalidrawWrapper;