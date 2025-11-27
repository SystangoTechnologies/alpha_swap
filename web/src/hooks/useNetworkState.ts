import { useState } from 'react';

const NETWORK_STORAGE_KEY = 'alphaswap_selected_network';
const DEFAULT_CHAIN_ID = 1; // Ethereum mainnet

export function useNetworkState() {
    const [selectedChainId, setSelectedChainIdState] = useState<number>(() => {
        // Try to load from localStorage
        const stored = localStorage.getItem(NETWORK_STORAGE_KEY);
        if (stored) {
            const parsed = parseInt(stored, 10);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
        return DEFAULT_CHAIN_ID;
    });

    const setSelectedChainId = (chainId: number) => {
        setSelectedChainIdState(chainId);
        localStorage.setItem(NETWORK_STORAGE_KEY, chainId.toString());
    };

    return {
        selectedChainId,
        setSelectedChainId
    };
}
