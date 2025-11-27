import { SupportedChainId } from '@cowprotocol/cow-sdk';
import { CONFIG } from '../config';

export interface Chain {
    chainId: number;
    name: string;
    icon: string;
    rpcUrl?: string;
    supportedChainId: SupportedChainId;
}

export const SUPPORTED_CHAINS: Chain[] = [
    {
        chainId: 1,
        name: 'Ethereum',
        icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
        rpcUrl: CONFIG.RPC_URLS.ETHEREUM,
        supportedChainId: SupportedChainId.MAINNET
    },
    {
        chainId: 100,
        name: 'Gnosis',
        icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/xdai/info/logo.png',
        rpcUrl: CONFIG.RPC_URLS.GNOSIS,
        supportedChainId: SupportedChainId.GNOSIS_CHAIN
    },
    {
        chainId: 42161,
        name: 'Arbitrum',
        icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
        rpcUrl: CONFIG.RPC_URLS.ARBITRUM,
        supportedChainId: SupportedChainId.ARBITRUM_ONE
    },
    {
        chainId: 8453,
        name: 'Base',
        icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
        rpcUrl: CONFIG.RPC_URLS.BASE,
        supportedChainId: SupportedChainId.BASE
    },
    {
        chainId: 11155111,
        name: 'Sepolia',
        icon: 'https://raw.githubusercontent.com/cowprotocol/cow-sdk/refs/heads/main/packages/config/src/chains/images/sepolia-logo.svg',
        rpcUrl: CONFIG.RPC_URLS.SEPOLIA,
        supportedChainId: SupportedChainId.SEPOLIA
    }
];

// Helper to get SupportedChainId from chainId number
export function getSupportedChainId(chainId: number): SupportedChainId | null {
    const chain = SUPPORTED_CHAINS.find(c => c.chainId === chainId);
    return chain?.supportedChainId || null;
}

// Helper to get chainId number from SupportedChainId
export function getChainIdNumber(supportedChainId: SupportedChainId): number | null {
    const chain = SUPPORTED_CHAINS.find(c => c.supportedChainId === supportedChainId);
    return chain?.chainId || null;
}

