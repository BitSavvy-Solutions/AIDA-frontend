/**
 * src/services/userService.js
 * Handles public user stats against the backend API.
 */
import { buildUrl, getRequestOptions } from '../config/apiConfig';

/**
 * Helper to make a request.
 */
const makeRequest = async (url, options = {}) => {
    try {
        const requestOptions = getRequestOptions(options.headers);
        return await fetch(url, {
            ...options,
            headers: requestOptions.headers,
            signal: requestOptions.signal,
        });
    } catch (error) {
        console.error(`Request failed: ${url}`, error);
        throw new Error(error.message || 'Network error');
    }
};

/**
 * Helper to parse JSON response.
 */
const parseResponse = async (response) => {
    const text = await response.text();
    if (!text) {
        if (response.ok) return { success: true };
        throw new Error('Empty response from server');
    }
    const data = JSON.parse(text);
    if (!response.ok) {
        throw new Error(data.message || 'API error');
    }
    return data;
};

/**
 * Fetches the total number of registered users (cached on backend).
 * @returns {Promise<object>} The total user count.
 */
const getUserCount = async () => {
    const url = buildUrl('/users', null, { action: 'count' });
    const response = await makeRequest(url, { method: 'GET' });
    const data = await parseResponse(response);
    return data.data || { total: 0, dau: 0, wau: 0, mau: 0 };
};

const userService = {
    getUserCount,
};

export default userService;