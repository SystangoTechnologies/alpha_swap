import { Token, TokenProvider } from './TokenProvider';

export class TokenService {
    private provider: TokenProvider;

    constructor(provider: TokenProvider) {
        this.provider = provider;
    }

    async getTokens(chainId: number): Promise<Token[]> {
        return this.provider.getTokens(chainId);
    }
}
