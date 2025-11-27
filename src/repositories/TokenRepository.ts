import fs from 'fs';
import path from 'path';
import { Token } from '../services/token/TokenProvider';

interface TokenStore {
    [protocol: string]: {
        [chainId: string]: Token[];
    };
}

export class TokenRepository {
    private filePath: string;
    private data: TokenStore | null = null;

    constructor() {
        // Resolve path relative to the compiled output or source
        // In production (dist), this should point to the copied JSON file
        // In development (src), it points to the source JSON
        this.filePath = path.resolve(__dirname, '../data/tokens.json');
    }

    private loadData(): TokenStore {
        // if (this.data) return this.data; // Disable caching to ensure fresh data across instances

        try {
            if (!fs.existsSync(this.filePath)) {
                console.warn(`[TokenRepository] File not found at ${this.filePath}, initializing empty store.`);
                return {};
            }
            const fileContent = fs.readFileSync(this.filePath, 'utf-8');
            this.data = JSON.parse(fileContent);
            return this.data!;
        } catch (error) {
            console.error('[TokenRepository] Error loading tokens.json:', error);
            return {};
        }
    }

    private saveData(data: TokenStore): void {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
            this.data = data; // Update cache
        } catch (error) {
            console.error('[TokenRepository] Error saving tokens.json:', error);
            throw error;
        }
    }

    public getTokens(protocol: string, chainId: number): Token[] {
        const data = this.loadData();
        const protocolData = data[protocol];
        if (!protocolData) return [];

        return protocolData[chainId.toString()] || [];
    }

    public updateTokens(protocol: string, chainId: number, tokens: Token[]): void {
        const data = this.loadData();

        if (!data[protocol]) {
            data[protocol] = {};
        }

        data[protocol][chainId.toString()] = tokens;
        this.saveData(data);
    }
}
