import dotenv from 'dotenv';
import { Wallet, JsonRpcProvider } from 'ethers';
import { CONFIG as JSON_CONFIG } from './config/loadConfig';

dotenv.config();

export const CONFIG = {
    PORT: process.env.PORT || 3000,
    // RPC URLs are loaded from config.json, env vars can override
    RPC_URLS: JSON_CONFIG.rpcUrls,
    GEMINI: {
        API_KEY: process.env.GEMINI_API_KEY,
        MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    },
    COW_SWAP: {
        // Token list URL from config.json, env var can override
        TOKEN_LIST_URL: process.env.COW_SWAP_TOKEN_LIST_URL || JSON_CONFIG.tokenListUrl,
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
