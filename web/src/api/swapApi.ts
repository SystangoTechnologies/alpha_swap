const API_URL = 'http://localhost:3000/api/swap';

export const swapApi = {
    getQuote: async (params: any) => {
        const response = await fetch(`${API_URL}/quote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get quote');
        }
        return response.json();
    },

    submitOrder: async (params: any) => {
        const response = await fetch(`${API_URL}/order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to submit order');
        }
        return response.json();
    },
};
