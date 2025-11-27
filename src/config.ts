import dotenv from 'dotenv';
import { Wallet, JsonRpcProvider } from 'ethers';

dotenv.config();

export const CONFIG = {
    PORT: process.env.PORT || 3000,
    RPC_URLS: {
        ETHEREUM: process.env.RPC_URL_ETHEREUM || 'https://eth.llamarpc.com',
        SEPOLIA: process.env.RPC_URL_SEPOLIA || 'https://eth-sepolia.public.blastapi.io',
        GNOSIS: process.env.RPC_URL_GNOSIS || 'https://rpc.gnosischain.com',
        ARBITRUM: process.env.RPC_URL_ARBITRUM || 'https://arb1.arbitrum.io/rpc',
        BASE: process.env.RPC_URL_BASE || 'https://mainnet.base.org',
    },
    GEMINI: {
        API_KEY: process.env.GEMINI_API_KEY,
        MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    },
    COW_SWAP: {
        TOKEN_LIST_URL: process.env.COW_SWAP_TOKEN_LIST_URL || 'https://files.cow.fi/tokens/CowSwap.json',
    },
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    // Fallback or default RPC URL if needed for general purposes
    DEFAULT_RPC_URL: process.env.RPC_URL || process.env.RPC_URL_SEPOLIA, 
};

if (!CONFIG.PRIVATE_KEY) {
    console.warn('WARNING: PRIVATE_KEY is not defined in .env. Using a random wallet for testing purposes only. You will not be able to place real orders.');
}

if (!CONFIG.DEFAULT_RPC_URL) {
    console.warn('WARNING: RPC_URL is not defined in .env. Some functionality might be limited.');
}

// Export provider and wallet for backward compatibility or default usage
export const provider = new JsonRpcProvider(CONFIG.DEFAULT_RPC_URL);
export const wallet = CONFIG.PRIVATE_KEY ? new Wallet(CONFIG.PRIVATE_KEY, provider) : Wallet.createRandom(provider);
