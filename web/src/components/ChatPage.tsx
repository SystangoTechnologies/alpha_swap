import { useState, useEffect, useRef } from 'react';
import { agentApi } from '../api/agentApi';
import type { Message } from '../api/agentApi';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useCowSdk } from '../hooks/useCowSdk';
import { useTokenApproval } from '../hooks/useTokenApproval';
import { WethService } from '../services/wethService';
import { ethers } from 'ethers';
import './ChatPage.css';
import { swapApi } from '../api/swapApi';

interface ChatPageProps {
    selectedChainId: number;
}

export function ChatPage({ selectedChainId }: ChatPageProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string>();
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [refreshingQuoteId, setRefreshingQuoteId] = useState<string | null>(null);
    const [isApproving, setIsApproving] = useState(false);
    const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
    const [_orderStatus, setOrderStatus] = useState<string | null>(null);
    const cowSdk = useCowSdk();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        // Only scroll to bottom if there are messages (not on initial load)
        if (messages.length > 0) {
            scrollToBottom();
            // Focus input after messages update (when agent responds)
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [messages]);

    const handleSendMessage = async (content: string) => {
        // Add user message
        const userMessage: Message = { role: 'user', content };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Send to agent
            const response = await agentApi.sendMessage(
                newMessages,
                {
                    currentAddress: cowSdk.account ?? undefined,
                    currentNetwork: selectedChainId,
                },
                conversationId
            );

            // Add assistant message
            const assistantMessage: Message = {
                role: 'assistant',
                content: response.assistantMessage,
                metadata: {
                    quote: response.quote,
                    requiredAction: response.requiredAction,
                    action: response.action,
                },
            };

            setMessages([...newMessages, assistantMessage]);

            if (response.conversationId) {
                setConversationId(response.conversationId);
            }

            // If we got a quote, check allowance immediately
            if (response.quote && cowSdk.provider && cowSdk.signer && cowSdk.account) {
                try {
                    const { TokenApprovalManager } = await import('../utils/tokenApproval');
                    const approvalManager = new TokenApprovalManager(cowSdk.provider, cowSdk.signer);

                    const allowanceCheck = await approvalManager.checkAllowance(
                        response.quote.quote.sellToken,
                        cowSdk.account,
                        response.quote.quote.sellAmount
                    );

                    if (!allowanceCheck.hasAllowance) {
                        // Need approval - update the last message (which contains the quote) to include the required action
                        // We don't want to add a new message, we want to update the existing one
                        setMessages(prev => {
                            const newMsgs = [...prev];
                            const lastMsg = newMsgs[newMsgs.length - 1];
                            if (lastMsg && lastMsg.metadata?.quote?.id === response.quote.id) {
                                return [
                                    ...newMsgs.slice(0, -1),
                                    {
                                        ...lastMsg,
                                        metadata: {
                                            ...lastMsg.metadata,
                                            requiredAction: 'REQUEST_ALLOWANCE'
                                        }
                                    }
                                ];
                            }
                            return newMsgs;
                        });
                    }
                } catch (error) {
                    console.error('Error checking allowance:', error);
                    // Don't block the flow if allowance check fails
                }
            }

            // Handle SUBMIT_ORDER action
            if (response.requiredAction === 'SUBMIT_ORDER') {
                const lastQuoteMsg = [...newMessages].reverse().find(m => m.metadata?.quote);

                if (lastQuoteMsg?.metadata?.quote) {
                    try {
                        // Check if approval is needed before submitting
                        const quote = lastQuoteMsg.metadata.quote;

                        // Check if wallet is connected
                        if (!cowSdk.provider || !cowSdk.signer || !cowSdk.account) {
                            const errorMessage: Message = {
                                role: 'assistant',
                                content: 'Please connect your wallet to submit the order.',
                            };
                            setMessages(prev => [...prev, errorMessage]);
                            return;
                        }

                        // Import TokenApprovalManager to check allowance
                        const { TokenApprovalManager } = await import('../utils/tokenApproval');
                        const approvalManager = new TokenApprovalManager(cowSdk.provider, cowSdk.signer);

                        const allowanceCheck = await approvalManager.checkAllowance(
                            quote.quote.sellToken,
                            cowSdk.account,
                            quote.quote.sellAmount
                        );

                        if (!allowanceCheck.hasAllowance) {
                            // Need approval - update the quote message to show approval UI
                            setMessages(prev => prev.map(msg => {
                                if (msg.metadata?.quote?.id === quote.id) {
                                    return {
                                        ...msg,
                                        metadata: {
                                            ...msg.metadata,
                                            requiredAction: 'REQUEST_ALLOWANCE'
                                        }
                                    };
                                }
                                return msg;
                            }));
                            return; // Don't submit order yet
                        }

                        // Allowance is sufficient, proceed with order
                        const orderId = await cowSdk.placeOrder(quote);

                        // Set order ID to start polling
                        setSubmittedOrderId(orderId);
                        setOrderStatus('open');

                        // Add success message with initial status
                        const successMessage: Message = {
                            role: 'assistant',
                            content: `⏳ Order submitted!\n\nOrder ID: ${orderId}\n\nStatus: Processing...\n\nYou can view it on the CoW Explorer.`,
                        };
                        setMessages(prev => [...prev, successMessage]);
                    } catch (error: any) {
                        console.error('Error placing order:', error);

                        // Check if it's an insufficient allowance error (fallback)
                        const isAllowanceError = error.message?.includes('InsufficientAllowance') ||
                            error.body?.errorType === 'InsufficientAllowance';

                        let errorContent: string;
                        if (isAllowanceError) {
                            errorContent = `⚠️ Token approval required!\n\nYou need to approve ${lastQuoteMsg.metadata.quote.sellTokenSymbol} before swapping. Please approve the token and try again.`;
                        } else if (error.code === 4001 || error.message?.includes('user rejected')) {
                            errorContent = 'Transaction was rejected. Please try again when ready.';
                        } else {
                            errorContent = `Failed to sign/submit order: ${error.message}. Please try again.`;
                        }

                        const errorMessage: Message = {
                            role: 'assistant',
                            content: errorContent,
                        };
                        setMessages(prev => [...prev, errorMessage]);
                    }
                } else {
                    const errorMessage: Message = {
                        role: 'assistant',
                        content: "I couldn't find the quote to submit. Please ask for a new quote.",
                    };
                    setMessages(prev => [...prev, errorMessage]);
                }
            }
        } catch (error: any) {
            console.error('Error sending message:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
            };
            setMessages([...newMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Poll order status
    useEffect(() => {
        if (!submittedOrderId || !selectedChainId) return;

        const pollStatus = async () => {
            try {
                const status = await swapApi.getOrderStatus(submittedOrderId, selectedChainId);
                setOrderStatus(status.status);

                // Update the last message with current status
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];

                    if (lastMsg && lastMsg.content.includes(submittedOrderId)) {
                        let statusEmoji = '⏳';
                        let statusText = 'Processing...';

                        if (status.status === 'fulfilled') {
                            statusEmoji = '✅';
                            statusText = 'Filled!';
                        } else if (status.status === 'cancelled') {
                            statusEmoji = '❌';
                            statusText = 'Cancelled';
                        } else if (status.status === 'expired') {
                            statusEmoji = '⚠️';
                            statusText = 'Expired';
                        }

                        newMessages[newMessages.length - 1] = {
                            ...lastMsg,
                            content: `${statusEmoji} Order ${status.status === 'fulfilled' ? 'Filled!' : statusText}\n\nOrder ID: ${submittedOrderId}\n\nStatus: ${status.status.charAt(0).toUpperCase() + status.status.slice(1)}\n\nYou can view it on the CoW Explorer.`,
                        };
                    }

                    return newMessages;
                });

                // Stop polling and reset if order is fulfilled, cancelled, or expired
                if (['fulfilled', 'cancelled', 'expired'].includes(status.status)) {
                    return true; // Stop polling
                }
            } catch (error) {
                console.error('Error polling order status:', error);
            }
            return false; // Continue polling
        };

        // Initial check
        pollStatus();

        const interval = setInterval(async () => {
            const shouldStop = await pollStatus();
            if (shouldStop) {
                clearInterval(interval);
                // Reset after showing final status for 3 seconds
                setTimeout(() => {
                    setSubmittedOrderId(null);
                    setOrderStatus(null);
                }, 3000);
            }
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(interval);
    }, [submittedOrderId, selectedChainId]);


    const handleAcceptQuote = () => {
        // For now, just send a confirmation message
        // In a full implementation, this would trigger the order submission flow
        handleSendMessage('Yes, please proceed with this quote.');
    };

    const handleConnectWallet = () => {
        // Trigger wallet connection
        // The WalletConnect component handles this
        alert('Please use the "Connect Wallet" button in the header to connect your wallet.');
    };

    const { approve } = useTokenApproval(cowSdk.provider, cowSdk.signer, cowSdk.account);

    const handleApproveToken = async (tokenAddress: string, amount: string, tokenSymbol: string) => {
        setIsApproving(true);
        try {
            await approve(tokenAddress, amount);

            // Update the message to remove the requirement locally
            setMessages(prev => prev.map(msg => {
                if (msg.metadata?.quote?.sellTokenSymbol === tokenSymbol && msg.metadata?.requiredAction === 'REQUEST_ALLOWANCE') {
                    return {
                        ...msg,
                        metadata: {
                            ...msg.metadata,
                            requiredAction: undefined
                        }
                    };
                }
                return msg;
            }));
        } catch (error: any) {
            console.error('Error approving token:', error);
            alert(`Failed to approve ${tokenSymbol}: ${error.message}`);
        } finally {
            setIsApproving(false);
        }
    };

    const handleQuoteRefresh = async (oldQuote: any) => {
        if (!oldQuote || !cowSdk.getQuote) return;

        // Set refreshing state
        setRefreshingQuoteId(oldQuote.id || 'unknown');

        try {
            // Use the same parameters as the original quote
            const sellToken = oldQuote.quote.sellToken;
            const buyToken = oldQuote.quote.buyToken;
            // Use original request amount if available, otherwise fall back to quote amount (which might be net of fees)
            const amount = oldQuote.requestAmount || (oldQuote.quote.kind === 'sell' ? oldQuote.quote.sellAmount : oldQuote.quote.buyAmount);
            const kind = oldQuote.quote.kind;
            const sellTokenDecimals = oldQuote.sellTokenDecimals || 18;
            const buyTokenDecimals = oldQuote.buyTokenDecimals || 18;

            // Fetch new quote
            const newQuoteResponse = await cowSdk.getQuote(
                sellToken,
                buyToken,
                amount,
                kind,
                sellTokenDecimals,
                buyTokenDecimals,
                selectedChainId
            );

            // Format amounts
            const formattedSellAmount = ethers.formatUnits(newQuoteResponse.quote.sellAmount, sellTokenDecimals);
            const formattedBuyAmount = ethers.formatUnits(newQuoteResponse.quote.buyAmount, buyTokenDecimals);
            const formattedFeeAmount = ethers.formatUnits(newQuoteResponse.quote.feeAmount, sellTokenDecimals);

            const updatedQuote = {
                ...newQuoteResponse,
                formattedSellAmount,
                formattedBuyAmount,
                formattedFeeAmount,
                sellTokenSymbol: oldQuote.sellTokenSymbol,
                buyTokenSymbol: oldQuote.buyTokenSymbol,
                sellTokenLogoURI: oldQuote.sellTokenLogoURI,
                buyTokenLogoURI: oldQuote.buyTokenLogoURI,
                sellTokenDecimals,
                buyTokenDecimals,
                requestAmount: oldQuote.requestAmount // Preserve request amount
            };

            // Update the message with the new quote
            setMessages(prevMessages => {
                const newMessages = [...prevMessages];
                // Find the message containing this quote and update it
                // We search from the end as it's likely the last one
                for (let i = newMessages.length - 1; i >= 0; i--) {
                    if (newMessages[i].metadata?.quote?.id === oldQuote.id) {
                        newMessages[i] = {
                            ...newMessages[i],
                            metadata: {
                                ...newMessages[i].metadata,
                                quote: updatedQuote
                            }
                        };
                        break;
                    }
                }
                return newMessages;
            });

        } catch (error) {
            console.error("Failed to refresh quote:", error);
            // Optionally notify user or just fail silently
        } finally {
            // Clear refreshing state
            setRefreshingQuoteId(null);
        }
    };

    const handleWrap = async (wrapAction: any) => {
        if (!cowSdk.provider || !cowSdk.signer || !cowSdk.chainId) {
            handleSendMessage('Please connect your wallet first.');
            return;
        }

        // Add "processing" message with loading indicator
        const processingMessage: Message = {
            role: 'assistant',
            content: `Processing ${wrapAction.wrapType}... Please confirm the transaction in your wallet.`,
            metadata: {
                isLoading: true,
            },
        };
        setMessages(prev => [...prev, processingMessage]);

        try {
            const wethService = new WethService(cowSdk.signer, cowSdk.chainId);
            let txHash: string;

            if (wrapAction.wrapType === 'wrap') {
                txHash = await wethService.wrap(wrapAction.wrapAmount);
            } else {
                txHash = await wethService.unwrap(wrapAction.wrapAmount);
            }

            // Replace the processing message with success message
            setMessages(prev => {
                const newMessages = [...prev];
                // Remove the last message (processing message)
                newMessages.pop();
                // Add success message
                newMessages.push({
                    role: 'assistant',
                    content: `✅ ${wrapAction.wrapType === 'wrap' ? 'Wrap' : 'Unwrap'} successful!\n\nTransaction Hash: ${txHash}\n\nYour balances will update automatically.`,
                });
                return newMessages;
            });

        } catch (error: any) {
            console.error('Error wrapping:', error);
            let errorMsg = error.message;

            // Handle user rejection
            if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
                errorMsg = 'Transaction was rejected.';
            }

            // Replace the processing message with error message
            setMessages(prev => {
                const newMessages = [...prev];
                // Remove the last message (processing message)
                newMessages.pop();
                // Add error message
                newMessages.push({
                    role: 'assistant',
                    content: `❌ Failed to ${wrapAction.wrapType}: ${errorMsg}`,
                });
                return newMessages;
            });
        }
    };

    return (
        <div className="chat-page">
            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-welcome">
                        <h2>👋 Welcome to Alpha Swap Agent!</h2>
                        <p>I can help you swap tokens on Ethereum and Sepolia networks.</p>
                        <div className="example-prompts">
                            <h3>Try asking:</h3>
                            <ul>
                                <li onClick={() => setInputValue("Swap 0.1 ETH for USDC")}>"Swap 0.1 ETH for USDC"</li>
                                <li onClick={() => setInputValue("I want to buy 100 DAI with ETH")}>"I want to buy 100 DAI with ETH"</li>
                                <li onClick={() => setInputValue("Get me a quote for swapping WETH to COW on Sepolia")}>"Get me a quote for swapping WETH to COW on Sepolia"</li>
                            </ul>
                        </div>
                    </div>
                )}

                {messages.map((msg, index) => (
                    <ChatMessage
                        key={index}
                        message={msg}
                        quote={msg.metadata?.quote}
                        requiredAction={msg.metadata?.requiredAction}
                        action={msg.metadata?.action}
                        onAcceptQuote={msg.metadata?.quote ? handleAcceptQuote : undefined}
                        onConnectWallet={msg.metadata?.requiredAction === 'REQUEST_WALLET_CONNECT' ? handleConnectWallet : undefined}
                        onApproveToken={msg.metadata?.requiredAction === 'REQUEST_ALLOWANCE' ? handleApproveToken : undefined}
                        onWrap={msg.metadata?.action?.type === 'WRAP' ? handleWrap : undefined}
                        onRefreshQuote={handleQuoteRefresh}
                        chainId={selectedChainId}
                        isRefreshing={refreshingQuoteId === msg.metadata?.quote?.id}
                        isApproving={isApproving}
                    />
                ))}

                {isLoading && (
                    <div className="loading-indicator">
                        <div className="loading-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <ChatInput
                ref={inputRef}
                onSend={handleSendMessage}
                disabled={isLoading}
                value={inputValue}
                onChange={setInputValue}
            />
        </div>
    );
}
