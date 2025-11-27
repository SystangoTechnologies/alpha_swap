import { type Token } from '../constants/tokens';

const API_URL = 'http://localhost:3000/api/tokens';

export const TokenService = {
    async fetchTokens(chainId: number = 1): Promise<Token[]> {
        try {
            const response = await fetch(`${API_URL}?chainId=${chainId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch token list');
            }
            const tokens: Token[] = await response.json();
            return tokens;
        } catch (error) {
            console.error('Error fetching tokens:', error);
            return [];
        }
    }
};
