/**
 * src/services/userService.js
 * Handles user registration and login against the backend API.
 */
import { buildUrl, getRequestOptions } from '../config/apiConfig';

/**
 * Custom error class for API-related issues.
 */
export class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

/**
 * Helper to make an authenticated request.
 */
const makeRequest = async (url, options = {}) => {
    try {
        const requestOptions = getRequestOptions(options.headers);
        const response = await fetch(url, { ...options, headers: requestOptions.headers, signal: requestOptions.signal });
        return response;
    } catch (error) {
        console.error(`❌ Request failed: ${url}`, error);
        throw new APIError(error.message || 'Network error', 0);
    }
};

/**
 * Helper to parse JSON response, with robust error handling.
 */
const parseResponse = async (response) => {
    const text = await response.text();
    if (!text) {
        if (response.ok) return { success: true };
        throw new APIError('Empty response from server', response.status);
    }
    try {
        const data = JSON.parse(text);
        if (!response.ok) {
            throw new APIError(data.message || 'API error', response.status, data);
        }
        return data;
    } catch (e) {
        if (e instanceof APIError) throw e;
        throw new APIError('Invalid JSON response from server', response.status, { raw: text });
    }
};

/**
 * Creates a new user in the backend.
 * @param {object} userData - The complete user data object.
 * @returns {Promise<object>} The newly created user object from the backend.
 */
const createUser = async (userData) => {
    const url = buildUrl('/users');
    const response = await makeRequest(url, {
        method: 'POST',
        body: JSON.stringify(userData),
    });
    return parseResponse(response);
};

/**
 * Fetches an existing user summary by their email to get their ID.
 * @param {string} email - The user's email.
 * @returns {Promise<object>} The user summary object from the backend.
 */
const getUserByEmail = async (email) => {
    const url = buildUrl('/users', null, { email });
    const response = await makeRequest(url, { method: 'GET' });
    const data = await parseResponse(response);
    // API queries often return an array, even for one result. We'll take the first.
    const result = Array.isArray(data.data) ? data.data[0] : data.data;
    return result; 
};

/**
 * Fetches a full user profile by their unique ID.
 * @param {string} id - The user's unique ID.
 * @returns {Promise<object>} The full user object from the backend.
 */
const getUserById = async (id) => {
    const url = buildUrl('/users', id);
    const response = await makeRequest(url, { method: 'GET' });
    // Assume get-by-id returns the full object, which may or may not be wrapped in 'data'.
    const data = await parseResponse(response);
    return data.data || data;
};


/**
 * A robust, unified function to handle both registration and login for a user.
 * It first attempts to create a user. If the user already exists (409 Conflict),
 * it now fetches the user's ID via email, and then uses that ID to get the full profile.
 * @param {Object} oauthData - Data from the Google OAuth provider.
 * @returns {Promise<Object>} An object containing user data and registration status.
 */
export const registerOrLoginUser = async (oauthData) => {
    const userData = {
        email: oauthData.email,
        name: oauthData.name,
        preferredLanguage: 'en', // ADDED: This was the missing required field.
        authProvider: 'google',
        googleUserId: oauthData.id,
        profilePictureUrl: oauthData.picture,
        lastLogin: new Date().toISOString(),
        appId: 'AIDA' // ADDED: Tell backend this user registered on AIDA
    };

    try {
        // --- ATTEMPT REGISTRATION PATH ---
        console.log('🚀 Attempting to create user (registration)...', userData);
        const newUser = await createUser(userData);
        return {
            success: true,
            isNewUser: true,
            user: newUser,
            message: 'Account created successfully!',
        };
    } catch (error) {
        // --- HANDLE LOGIN PATH (User Already Exists) ---
        if (error instanceof APIError && error.status === 409) {
            console.log('✅ User already exists. Fetching full profile (login)...');
            try {
                // Step 1: Get the user summary (which includes the ID) by email.
                const userSummary = await getUserByEmail(userData.email);
                if (!userSummary || !userSummary.userId) {
                    throw new APIError('User exists, but their ID could not be retrieved by email.', 500);
                }

                // Step 2: Use the ID from the summary to get the full profile.
                // This ensures we get all fields like 'name' and 'profilePictureUrl'.
                const existingUser = await getUserById(userSummary.userId);

                return {
                    success: true,
                    isNewUser: false,
                    user: existingUser,
                    message: 'Welcome back!',
                };
            } catch (fetchError) {
                console.error('❌ CRITICAL: User exists, but fetching their full profile failed.', fetchError);
                throw new APIError('User exists, but their profile could not be retrieved. Please try again.', 500, fetchError.data);
            }
        }

        // --- BUBBLE UP OTHER, UNEXPECTED ERRORS ---
        console.error('❌ Unhandled error during user registration/login:', error);
        throw error;
    }
};

/**
 * Fetches the total number of registered users (cached on backend).
 * @returns {Promise<number>} The total user count.
 */
const getUserCount = async () => {
    const url = buildUrl('/users', null, { action: 'count' });
    const response = await makeRequest(url, { method: 'GET' });
    const data = await parseResponse(response);
    return data.count || 0;
};

const userService = {
    registerOrLoginUser,
    getUserCount,
    APIError,
};

export default userService;