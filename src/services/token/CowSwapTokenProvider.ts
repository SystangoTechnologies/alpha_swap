import { Token, TokenProvider } from './TokenProvider';
import { CONFIG } from '../../config';

const COW_SWAP_TOKEN_LIST_URL = CONFIG.COW_SWAP.TOKEN_LIST_URL;

// Sepolia testnet tokens - CoW Swap supports these but doesn't include them in their token list API
const SEPOLIA_TEST_TOKENS: Token[] = [
    {
        chainId: 11155111,
        address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
        logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    },
    {
        chainId: 11155111,
        address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        name: 'Wrapped Ether',
        symbol: 'WETH',
        decimals: 18,
        logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    },
    {
        chainId: 11155111,
        address: '0xbe72E441BF55620febc26715db68d3494213D8Cb',
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 18, // Sepolia USDC uses 18 decimals (unlike mainnet which uses 6)
        logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    },
    {
        chainId: 11155111,
        address: '0xB4F1737Af37711e9A5890D9510c9bB60e170CB0D',
        name: 'Dai Stablecoin',
        symbol: 'DAI',
        decimals: 18,
        logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    },
    {
        chainId: 11155111,
        address: '0x0625aFB445C3B6B7B929342a04A22599fd5dBB59',
        name: 'CoW Protocol Token',
        symbol: 'COW',
        decimals: 18,
        logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xDEf1CA1fb7FBcDC777520aa7f396b4E015F497aB/logo.png',
    },
    {
        chainId: 11155111,
        address: '0xd3f3d46FeBCD4CdAa2B83799b7A5CdcB69d135De',
        name: 'Gnosis',
        symbol: 'GNO',
        decimals: 18,
        logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6810e776880C02933D47DB1b9fc05908e5386b96/logo.png',
    },
    {
        chainId: 11155111,
        address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        name: 'Uniswap',
        symbol: 'UNI',
        decimals: 18,
        logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
    }
];

interface TokenListResponse {
    name: string;
    timestamp: string;
    version: {
        major: number;
        minor: number;
        patch: number;
    };
    tokens: Array<{
        chainId: number;
        address: string;
        name: string;
        symbol: string;
        decimals: number;
        logoURI?: string;
    }>;
}

export class CowSwapTokenProvider implements TokenProvider {
    async getTokens(chainId: number): Promise<Token[]> {
        // Special case for Sepolia testnet - return test tokens
        if (chainId === 11155111) {
            return SEPOLIA_TEST_TOKENS;
        }

        try {
            const response = await fetch(COW_SWAP_TOKEN_LIST_URL);
            if (!response.ok) {
                throw new Error('Failed to fetch token list');
            }
            const data: TokenListResponse = await response.json();

            const tokens = data.tokens
                .filter(t => t.chainId === chainId)
                .map(t => ({
                    chainId: t.chainId,
                    address: t.address,
                    name: t.name,
                    symbol: t.symbol,
                    decimals: t.decimals,
                    logoURI: t.logoURI
                }));

            // Add native ETH as the first token
            const nativeEth: Token = {
                chainId,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
                logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
            };

            return [nativeEth, ...tokens];
        } catch (error) {
            console.error('Error fetching tokens from CoW Swap:', error);
            return [];
        }
    }
}
