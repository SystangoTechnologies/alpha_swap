import configData from './config.json';
import chainsData from './chainsData.json';

interface Config {
    rpcUrls: Record<string, string>;
    tokenListUrl: string;
}

interface Chain {
    id: number;
    name: string;
    icon: string;
    rpcUrl: string;
    supportedChainId: number;
}

export const CONFIG: Config = configData;

// Resolve placeholders like ${rpcUrls.ETHEREUM} in chains.json
export const CHAINS: Chain[] = chainsData.map((c: any) => {
    const resolvedRpc = c.rpcUrl.replace(/\$\{rpcUrls\.(\w+)\}/, (_: string, key: string) => CONFIG.rpcUrls[key] ?? '');
    return {
        id: c.id,
        name: c.name,
        rpcUrl: resolvedRpc,
        icon: c.icon,
        supportedChainId: c.supportedChainId
    } as Chain;
});
