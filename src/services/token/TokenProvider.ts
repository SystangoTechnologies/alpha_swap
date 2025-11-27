export interface Token {
    chainId: number;
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
}

export interface TokenProvider {
    getTokens(chainId: number): Promise<Token[]>;
}
