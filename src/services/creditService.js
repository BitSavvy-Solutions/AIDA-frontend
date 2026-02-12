import { buildUrl, getRequestOptions } from '../config/apiConfig';

const creditService = {
    /**
     * Get current balance for a user
     */
    getBalance: async (userId) => {
        try {
            const url = buildUrl(`/credits/${userId}`);
            const response = await fetch(url, getRequestOptions());
            const data = await response.json();
            return data.success ? data.data.balance : 0.0;
        } catch (error) {
            console.error("Failed to fetch balance:", error);
            return 0.0;
        }
    },

    /**
     * Create a Stripe Checkout Session
     */
    createCheckoutSession: async (userId, amount) => {
        try {
            const url = buildUrl('/payments/create-checkout');

            // 1. Get the base headers/signal
            const baseOptions = getRequestOptions();

            // 2. Construct the full fetch options correctly
            const options = {
                ...baseOptions, // Spread headers and signal
                method: 'POST', // Define method at the root level
                body: JSON.stringify({ userId, amount }) // Define body at the root level
            };
            
            const response = await fetch(url, options);

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error(`Server returned ${response.status}: ${text}`);
            }
            
            if (!response.ok) throw new Error(data.error || 'Payment init failed');
            
            return data.url; // The Stripe URL
        } catch (error) {
            console.error("Payment creation failed:", error);
            throw error;
        }
    }
};

export default creditService;