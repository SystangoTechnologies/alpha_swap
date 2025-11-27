import { Token, TokenProvider } from './TokenProvider';
import { TokenRepository } from '../../repositories/TokenRepository';

export class CowSwapTokenProvider implements TokenProvider {
    private repository: TokenRepository;

    constructor() {
        this.repository = new TokenRepository();
    }

    async getTokens(chainId: number): Promise<Token[]> {
        try {
            // Fetch tokens from local repository
            const tokens = this.repository.getTokens('cowSwap', chainId);

            if (tokens.length === 0) {
                console.warn(`[CowSwapTokenProvider] No tokens found in local store for chain ${chainId}.`);
                return [];
            }

            return tokens;
        } catch (error) {
            console.error('[CowSwapTokenProvider] Error getting tokens:', error);
            return [];
        }
    }
}
