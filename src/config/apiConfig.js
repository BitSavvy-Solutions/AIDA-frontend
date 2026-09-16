// src/config/apiConfig.js

const isDevelopment = import.meta.env.MODE === 'development';

const config = {
    AZURE_FUNCTIONS_URL: isDevelopment
        ? 'https://aitutfunc.azurewebsites.net/api'
        : 'https://aitutfunc.azurewebsites.net/api',

    FASTAPI_URL: isDevelopment
        ? 'https://aida-agentbackend-prod.graydune-dda4d1ba.canadaeast.azurecontainerapps.io/api'
        : 'https://aida-agentbackend-prod.graydune-dda4d1ba.canadaeast.azurecontainerapps.io/api',

    // NEW: Encrypted vault service
    VAULT_URL: isDevelopment
        ? 'https://ethivault-dev.graydune-dda4d1ba.canadaeast.azurecontainerapps.io/api/vault'
        : 'https://ethivault-dev.graydune-dda4d1ba.canadaeast.azurecontainerapps.io/api/vault',

    FRONTEND_URL: isDevelopment
        ? 'http://localhost:5173'
        : window.location.origin,

    FUNCTION_HOST_KEY: 'dlkgVHOPghXdpOeE9SgyYe0r6nN3AjuEowskmJsDDhrBAzFuSlPb7g==',

    TIMEOUT: 15000,

    ENDPOINTS: {
        USERS: '/users',
        USER_BY_ID: '/users',
        AUTH_GOOGLE: '/auth/google',
        AUTH_LOGOUT: '/auth/logout',
    },

    DEFAULT_HEADERS: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'AIDA-Portal/1.0'
    },
};

export const buildUrl = (endpoint, id = null, queryParams = {}) => {
    let url = config.AZURE_FUNCTIONS_URL + endpoint;
    if (id) url += `/${id}`;
    const params = new URLSearchParams(queryParams);
    if (params.toString()) url += `?${params.toString()}`;
    return url;
};

export const getRequestOptions = (additionalHeaders = {}) => {
    const headers = { ...config.DEFAULT_HEADERS, ...additionalHeaders };
    if (config.FUNCTION_HOST_KEY) {
        headers['x-functions-key'] = config.FUNCTION_HOST_KEY;
    }
    const storedToken = localStorage.getItem('aidaToken');
    const storedExpiry = localStorage.getItem('aidaTokenExpiry');
    const tokenIsValid = storedToken && storedExpiry && new Date() < new Date(storedExpiry);
    if (tokenIsValid) headers['Authorization'] = `Bearer ${storedToken}`;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), config.TIMEOUT);
    return { headers, signal: controller.signal };
};

export default config;