import React, { useState, useEffect } from 'react';
import { FiSettings, FiSave, FiX, FiGlobe, FiType, FiKey, FiCpu, FiMoon, FiSun } from 'react-icons/fi';

const ConfigurationPage = ({ initialConfig = {}, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    agentName: 'AIDA',
    language: 'en',
    theme: 'light',
    apiKey: '',
    model: 'default',
    voice: 'default',
    ...initialConfig
  });

  // Load saved config on initial render
  useEffect(() => {
    const savedConfig = localStorage.getItem('aida-widget-config');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setFormData(prev => ({ ...prev, ...parsedConfig }));
      } catch (e) {
        console.error('Failed to parse saved config:', e);
      }
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) onSave(formData);
  };

  return (
    <div className="aida-config-container">
      <div className="aida-config-header">
        <div className="aida-config-title">
          <FiSettings className="config-icon" />
          <h2>Configure {formData.agentName}</h2>
        </div>
        {onCancel && (
          <button className="aida-config-close" onClick={onCancel}>
            <FiX />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="aida-config-form">
        <div className="aida-config-section">
          <h3>Basic Settings</h3>
          
          <div className="aida-config-field">
            <label htmlFor="agentName">
              <FiType className="field-icon" />
              Agent Name
            </label>
            <input
              type="text"
              id="agentName"
              name="agentName"
              value={formData.agentName}
              onChange={handleChange}
              placeholder="Enter agent name"
              required
            />
          </div>
          
          <div className="aida-config-field">
            <label htmlFor="language">
              <FiGlobe className="field-icon" />
              Language
            </label>
            <select
              id="language"
              name="language"
              value={formData.language}
              onChange={handleChange}
              className="aida-select"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ar">Arabic</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="ru">Russian</option>
              <option value="pt">Portuguese</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
          
          <div className="aida-config-field">
            <label htmlFor="theme">
              {formData.theme === 'dark' ? <FiMoon className="field-icon" /> : <FiSun className="field-icon" />}
              Theme
            </label>
            <select
              id="theme"
              name="theme"
              value={formData.theme}
              onChange={handleChange}
              className="aida-select"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System Default</option>
            </select>
          </div>
        </div>

        <div className="aida-config-section">
          <h3>Advanced Settings</h3>
          
          <div className="aida-config-field">
            <label htmlFor="apiKey">
              <FiKey className="field-icon" />
              API Key
            </label>
            <input
              type="password"
              id="apiKey"
              name="apiKey"
              value={formData.apiKey}
              onChange={handleChange}
              placeholder="Enter your API key (optional)"
            />
            <small>Your API key is stored locally and never sent to our servers.</small>
          </div>

          <div className="aida-config-field">
            <label htmlFor="model">
              <FiCpu className="field-icon" />
              AI Model
            </label>
            <select
              id="model"
              name="model"
              value={formData.model}
              onChange={handleChange}
              className="aida-select"
            >
              <option value="default">Default (Recommended)</option>
              <option value="gpt-4">GPT-4</option>
              <option value="claude-3">Claude 3 Sonnet</option>
              <option value="claude-3-opus">Claude 3 Opus</option>
              <option value="llama-3">Llama 3</option>
              <option value="gemini-pro">Gemini Pro</option>
            </select>
          </div>

          <div className="aida-config-field">
            <label htmlFor="voice">Voice</label>
            <select
              id="voice"
              name="voice"
              value={formData.voice}
              onChange={handleChange}
              className="aida-select"
            >
              <option value="default">Default</option>
              <option value="alloy">Alloy</option>
              <option value="echo">Echo</option>
              <option value="fable">Fable</option>
              <option value="onyx">Onyx</option>
              <option value="nova">Nova</option>
              <option value="shimmer">Shimmer</option>
            </select>
          </div>
          
          <div className="aida-config-toggles">
            <div className="aida-config-toggle">
              <label>
                <input
                  type="checkbox"
                  name="enableHistory"
                  checked={formData.enableHistory}
                  onChange={(e) => handleChange({ target: { name: 'enableHistory', value: e.target.checked } })}
                />
                <span>Save chat history</span>
              </label>
            </div>
            
            <div className="aida-config-toggle">
              <label>
                <input
                  type="checkbox"
                  name="enableVoice"
                  checked={formData.enableVoice}
                  onChange={(e) => handleChange({ target: { name: 'enableVoice', value: e.target.checked } })}
                />
                <span>Enable voice interactions</span>
              </label>
            </div>
          </div>
        </div>

        <div className="aida-config-actions">
          {onCancel && (
            <button type="button" onClick={onCancel} className="aida-cancel-btn">
              Cancel
            </button>
          )}
          <button type="submit" className="aida-save-btn">
            <FiSave className="btn-icon" />
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConfigurationPage;