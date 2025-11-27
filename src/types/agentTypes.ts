export type MessageRole = 'user' | 'assistant';

export interface Message {
    role: MessageRole;
    content: string;
    metadata?: any;
}

export type ActionType =
    | 'NO_ACTION'
    | 'REQUEST_WALLET_CONNECT'
    | 'GET_QUOTE'
    | 'SUBMIT_ORDER'
    | 'REQUEST_ALLOWANCE'
    | 'CHECK_BALANCE'
    | 'WRAP';

export interface AgentAction {
    type: ActionType;
    network?: 'ethereum' | 'sepolia';
    sellToken?: string;
    buyToken?: string;
    amountType?: 'sell' | 'buy';
    amount?: string;
    quoteId?: string;
    token?: string; // For CHECK_BALANCE action (single token)
    tokens?: string[]; // For CHECK_BALANCE action (multiple tokens)
    // Wrap-specific fields
    wrapType?: 'wrap' | 'unwrap';
    wrapAmount?: string;
}

export interface WalletContext {
    currentAddress?: string;
    currentNetwork?: number;
}

export interface AgentResponse {
    assistantMessage: string;
    quote?: any;
    orderId?: string;
    requiredAction?: ActionType;
    action?: AgentAction;
    conversationId?: string;
    balance?: string; // For CHECK_BALANCE responses
}

export interface AgentMessageRequest {
    conversationId?: string;
    messages: Message[];
    walletContext?: WalletContext;
}
