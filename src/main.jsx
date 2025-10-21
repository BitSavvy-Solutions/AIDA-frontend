import React from 'react';
import { createRoot } from 'react-dom/client';
import ConfigurationPage from './components/ConfigurationPage';

// Export the configuration component
export { ConfigurationPage };

// Default export for UMD build
export default {
  ConfigurationPage,
  // You can include a render function here if needed
  render: (containerId, config = {}) => {
    const container = document.querySelector(containerId);
    if (!container) {
      console.error(`Container not found: ${containerId}`);
      return;
    }
    
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <ConfigurationPage 
          initialConfig={config} 
          onSave={(newConfig) => {
            console.log("Saving config:", newConfig);
            localStorage.setItem('aida-widget-config', JSON.stringify(newConfig));
          }}
        />
      </React.StrictMode>
    );
  }
};