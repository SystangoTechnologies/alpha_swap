const API_URL = 'http://localhost:3000/api/agent';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    metadata?: any;
}

export interface WalletContext {
    currentAddress?: string;
    currentNetwork?: number;
}

export interface AgentResponse {
    assistantMessage: string;
    quote?: any;
    orderId?: string;
    requiredAction?: string;
    action?: any;
    conversationId?: string;
}

export const agentApi = {
    sendMessage: async (
        messages: Message[],
        walletContext?: WalletContext,
        conversationId?: string
    ): Promise<AgentResponse> => {
        const response = await fetch(`${API_URL}/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages,
                walletContext,
                conversationId,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to send message');
        }

        return response.json();
    },
};
