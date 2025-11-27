import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message, AgentAction, ActionType } from '../types/agentTypes';
import { CowSwapTokenProvider } from './token/CowSwapTokenProvider';
import { Token } from './token/TokenProvider';
import { CONFIG } from '../config';
import { AGENT_SYSTEM_PROMPT, TOKEN_ADDRESSES } from '../constants';

export class AgentService {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private tokenProvider: CowSwapTokenProvider;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is required. Please set it in your .env file.');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        // Updated to a valid Gemini model identifier
        this.model = this.genAI.getGenerativeModel({ model: CONFIG.GEMINI.MODEL });
        this.tokenProvider = new CowSwapTokenProvider();
    }

    private getSystemPrompt(): string {
        return AGENT_SYSTEM_PROMPT;
    }

    async processMessage(messages: Message[], walletContext?: { currentAddress?: string; currentNetwork?: number }): Promise<{ message: string; action: AgentAction }> {
        try {
            const conversationHistory = messages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            const networkName = walletContext?.currentNetwork === 11155111 ? 'sepolia' :
                walletContext?.currentNetwork === 1 ? 'ethereum' : 'unknown';

            // Fetch available tokens for the current network
            const chainId = walletContext?.currentNetwork || 1;
            const availableTokens = await this.tokenProvider.getTokens(chainId);
            const tokenList = availableTokens.map(t => `${t.symbol} (${t.name})`).join(', ');

            const systemContext = `System Context:\\n- Wallet Connected: ${walletContext?.currentAddress ? 'Yes (' + walletContext.currentAddress + ')' : 'No'}\\n- Current Network: ${networkName} (chainId: ${walletContext?.currentNetwork || 'Not connected'})\\n- Available Tokens on ${networkName}: ${tokenList}\\n\\n${this.getSystemPrompt()}`;

            const chat = this.model.startChat({
                history: [
                    { role: 'user', parts: [{ text: systemContext }] },
                    { role: 'model', parts: [{ text: 'I understand. I am AlphaSwap Agent and will help users swap tokens on Ethereum and Sepolia networks only. I will always respond with a message and an ACTION in JSON format.' }] },
                    ...conversationHistory.slice(0, -1)
                ]
            });

            const latestMessage = messages[messages.length - 1];
            const result = await chat.sendMessage(latestMessage.content);
            const responseText = result.response.text();
            const { message, action } = this.parseResponse(responseText);

            // Inject network from context if missing in action
            if (action.type !== 'NO_ACTION' && !action.network && walletContext?.currentNetwork) {
                action.network = walletContext.currentNetwork === 11155111 ? 'sepolia' : 'ethereum';
            }

            return { message, action };
        } catch (error: any) {
            console.error('Error in AgentService:', error);
            throw new Error(`Failed to process message: ${error.message}`);
        }
    }

    private parseResponse(responseText: string): { message: string; action: AgentAction } {
        const parts = responseText.split('ACTION:');
        let message = parts[0].trim();
        let action: AgentAction = { type: 'NO_ACTION' };
        if (parts.length > 1) {
            try {
                const actionText = parts[1].trim();
                const jsonMatch = actionText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    action = JSON.parse(jsonMatch[0]);
                }
            } catch (error) {
                console.error('Failed to parse action JSON:', error);
            }
        }
        return { message, action };
    }

    /** Resolve a token identifier (symbol or address) to a proper 0x address for the given network. */
    /** Resolve a token identifier (symbol or address) to a proper 0x address for the given network. */
    public async resolveTokenAddress(token: string, network: string = 'ethereum'): Promise<string> {
        if (/^0x[0-9a-fA-F]{40}$/.test(token)) {
            return token;
        }

        const chainId = network === 'sepolia' ? 11155111 : 1;
        const tokens = await this.tokenProvider.getTokens(chainId);

        const foundToken = tokens.find(t => t.symbol.toUpperCase() === token.toUpperCase());

        if (foundToken) {
            return foundToken.address;
        }

        // Fallback to hardcoded map if provider fails or token not found
        const symbol = token.toUpperCase();
        const tokenAddresses = TOKEN_ADDRESSES;
        return tokenAddresses[symbol]?.[network] ?? token;
    }

    /** Validate that a string is a proper 0x address (20 bytes). */
    public static isValidAddress(address: string): boolean {
        return /^0x[0-9a-fA-F]{40}$/.test(address);
    }

    validateAction(action: AgentAction): { valid: boolean; error?: string } {
        if (action.type === 'GET_QUOTE') {
            if (!action.network || !['ethereum', 'sepolia'].includes(action.network)) {
                return { valid: false, error: 'Invalid or missing network' };
            }
            if (!action.sellToken || !action.buyToken) {
                return { valid: false, error: 'Missing token addresses' };
            }
            if (!action.amount || !action.amountType) {
                return { valid: false, error: 'Missing amount or amountType' };
            }
        }

        if (action.type === 'SUBMIT_ORDER') {
            // SUBMIT_ORDER is a signal to the frontend, so we don't strictly need tokens here
            // as the frontend has the quote context.
            // We just need to ensure the network is valid if provided, or it will be defaulted.
            if (action.network && !['ethereum', 'sepolia'].includes(action.network)) {
                return { valid: false, error: 'Invalid network' };
            }
        }

        if (action.type === 'CHECK_BALANCE') {
            if (!action.token && !action.tokens) {
                return { valid: false, error: 'Missing token or tokens for balance check' };
            }
        }
        return { valid: true };
    }
}
