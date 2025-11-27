import { SupportedChainId } from '@cowprotocol/cow-sdk';
import { CHAINS } from './loadConfig';

export interface Chain {
    chainId: number;
    name: string;
    icon: string;
    rpcUrl?: string;
    supportedChainId: SupportedChainId;
}

// Export the array as SUPPORTED_CHAINS for backward compatibility
export const SUPPORTED_CHAINS: Chain[] = CHAINS.map((c) => ({
    chainId: c.id,
    name: c.name,
    icon: c.icon,
    rpcUrl: c.rpcUrl,
    supportedChainId: c.supportedChainId as SupportedChainId,
}));

// Helper to get SupportedChainId from chainId number
export function getSupportedChainId(chainId: number): SupportedChainId | null {
    const chain = SUPPORTED_CHAINS.find((c) => c.chainId === chainId);
    return chain?.supportedChainId || null;
}

// Helper to get chainId number from SupportedChainId
export function getChainIdNumber(supportedChainId: SupportedChainId): number | null {
    const chain = SUPPORTED_CHAINS.find((c) => c.supportedChainId === supportedChainId);
    return chain?.chainId || null;
}
