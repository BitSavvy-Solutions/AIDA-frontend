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
 * Fetches an existing user by their email.
 * @param {string} email - The user's email.
 * @returns {Promise<object>} The user object from the backend.
 */
const getUserByEmail = async (email) => {
    const url = buildUrl('/users', null, { email });
    const response = await makeRequest(url, { method: 'GET' });
    const data = await parseResponse(response);
    return data.data; // The user object is nested under a 'data' key for this endpoint
};


/**
 * A robust, unified function to handle both registration and login for a user.
 * It first attempts to create a user. If the user already exists (409 Conflict),
 * it then fetches the existing user's full profile by email.
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
                const existingUser = await getUserByEmail(userData.email);
                return {
                    success: true,
                    isNewUser: false,
                    user: existingUser,
                    message: 'Welcome back!',
                };
            } catch (fetchError) {
                console.error('❌ CRITICAL: User exists, but fetching profile failed.', fetchError);
                throw new APIError('User exists, but their profile could not be retrieved. Please try again.', 500, fetchError.data);
            }
        }

        // --- BUBBLE UP OTHER, UNEXPECTED ERRORS ---
        console.error('❌ Unhandled error during user registration/login:', error);
        throw error;
    }
};

const userService = {
    registerOrLoginUser,
    APIError,
};

export default userService;