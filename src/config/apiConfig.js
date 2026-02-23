/**
 * src/config/apiConfig.js
 * Configures the backend API connection.
 */

// Detect if the app is running in a development environment (localhost)
const isDevelopment = import.meta.env.MODE === 'development';

const config = {
    // AUTOMATIC SWITCHING:
    // If Local: Uses localhost:7071 (Standard Azure Function local port)
    // If Prod: Uses your live Azure URL
    AZURE_FUNCTIONS_URL: isDevelopment
        ? 'http://localhost:7071/api' 
        : 'https://aitutfunc.azurewebsites.net/api',

    // Frontend URL for redirects (Stripe success/cancel)
    FRONTEND_URL: isDevelopment
        ? 'http://localhost:5173'
        : window.location.origin,
    
    // The master key for your Azure Functions host.
    // It is recommended to use a single host key for simplicity.
    FUNCTION_HOST_KEY: 'dlkgVHOPghXdpOeE9SgyYe0r6nN3AjuEowskmJsDDhrBAzFuSlPb7g==',
    
    // Default request timeout in milliseconds
    TIMEOUT: 15000,
    
    // API Endpoints
    ENDPOINTS: {
        // User management API
        USERS: '/users',
        USER_BY_ID: '/users', // Endpoint will be `/users/{id}`
    },
    
    // Default headers for all requests
    DEFAULT_HEADERS: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'AIDA-Portal/1.0'
    },
};

/**
 * Builds a complete URL for a given API endpoint.
 * @param {string} endpoint - The endpoint path (e.g., '/users').
 * @param {string|null} id - An optional ID to append to the path.
 * @param {object} queryParams - Optional query parameters.
 * @returns {string} The full URL.
 */
export const buildUrl = (endpoint, id = null, queryParams = {}) => {
    let url = config.AZURE_FUNCTIONS_URL + endpoint;
    
    if (id) {
        url += `/${id}`;
    }
    
    const params = new URLSearchParams(queryParams);
    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    return url;
};

/**
 * Prepares the options for a fetch request, including headers and a timeout signal.
 * @param {object} additionalHeaders - Any extra headers for the request.
 * @returns {object} Options object for the fetch API.
 */
export const getRequestOptions = (additionalHeaders = {}) => {
    const headers = {
        ...config.DEFAULT_HEADERS,
        ...additionalHeaders
    };

    if (config.FUNCTION_HOST_KEY) {
        headers['x-functions-key'] = config.FUNCTION_HOST_KEY;
    } else {
        console.error('❌ CRITICAL: No function host key found in apiConfig.js');
    }
    
    const controller = new AbortController();
    setTimeout(() => controller.abort(), config.TIMEOUT);
    
    return {
        headers,
        signal: controller.signal,
    };
};

export default config;