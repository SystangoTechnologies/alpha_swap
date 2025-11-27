import { Request, Response } from 'express';
import { AgentService } from '../services/agentService';
import { SwapService } from '../services/swapService';
import { AgentMessageRequest, AgentResponse, Message } from '../types/agentTypes';
import { CONFIG } from '../config';

let agentService: AgentService | null = null;

function getAgentService(): AgentService {
    if (!agentService) {
        const apiKey = CONFIG.GEMINI.API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not configured. Please add it to your .env file. See CHAT_AGENT_SETUP.md for instructions.');
        }
        agentService = new AgentService(apiKey);
    }
    return agentService;
}

export const sendMessage = async (req: Request, res: Response) => {
    try {
        // Check if API key is configured
        const service = getAgentService();

        const { conversationId, messages, walletContext }: AgentMessageRequest = req.body;

        // Validate request
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        // Process message with agent
        console.log('Processing message with agent...');
        const { message: assistantMessage, action } = await service.processMessage(messages, walletContext);
        console.log('Agent Action:', JSON.stringify(action, null, 2));

        // Validate action
        const validation = service.validateAction(action);
        if (!validation.valid) {
            return res.status(400).json({
                error: `Invalid action: ${validation.error}`,
                assistantMessage: `I apologize, but I encountered an error: ${validation.error}. Please try rephrasing your request.`
            });
        }

        // Initialize response
        const response: AgentResponse = {
            assistantMessage,
            conversationId: conversationId || `conv_${Date.now()}`,
        };

        // Handle different action types
        switch (action.type) {
            case 'REQUEST_WALLET_CONNECT':
                response.requiredAction = 'REQUEST_WALLET_CONNECT';
                break;

            case 'GET_QUOTE':
                try {
                    // Map network to chainId
                    const chainId = action.network === 'sepolia' ? 11155111 : 1;

                    // Resolve token addresses (in case symbols were provided)
                    // Resolve token addresses
                    const sellTokenAddress = await service.resolveTokenAddress(action.sellToken!, action.network || 'ethereum');
                    const buyTokenAddress = await service.resolveTokenAddress(action.buyToken!, action.network || 'ethereum');

                    // Validate resolved addresses
                    if (!AgentService.isValidAddress(sellTokenAddress) || !AgentService.isValidAddress(buyTokenAddress)) {
                        response.assistantMessage = 'One or both token addresses are invalid. Please provide valid ERC‑20 contract addresses or supported symbols.';
                        break;
                    }

                    // Check for wrap/unwrap scenario
                    const isNativeEth = (addr: string) => addr.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
                    const wethAddresses: { [key: string]: string } = {
                        'ethereum': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                        'sepolia': '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
                    };
                    const isWeth = (addr: string, network: string) => {
                        return addr.toLowerCase() === wethAddresses[network]?.toLowerCase();
                    };

                    const network = action.network || 'ethereum';
                    const isWrapScenario =
                        (isNativeEth(sellTokenAddress) && isWeth(buyTokenAddress, network)) ||
                        (isWeth(sellTokenAddress, network) && isNativeEth(buyTokenAddress));

                    if (isWrapScenario) {
                        const wrapType = isNativeEth(sellTokenAddress) ? 'wrap' : 'unwrap';
                        response.assistantMessage = `I'll help you ${wrapType} ${action.amount} ${action.sellToken} to ${action.buyToken}. This is a 1:1 conversion. Click the "${wrapType === 'wrap' ? 'Wrap' : 'Unwrap'}" button below to proceed.`;
                        response.action = {
                            type: 'WRAP',
                            wrapType,
                            wrapAmount: action.amount!,
                            sellToken: action.sellToken!,
                            buyToken: action.buyToken!,
                            network: action.network || 'ethereum'
                        };
                        break;
                    }

                    // Get token info for decimals
                    const { CowSwapTokenProvider } = await import('../services/token/CowSwapTokenProvider');
                    const tokenProvider = new CowSwapTokenProvider();
                    const availableTokens = await tokenProvider.getTokens(chainId);
                    const sellTokenInfo = availableTokens.find(t => t.address.toLowerCase() === sellTokenAddress.toLowerCase());
                    const buyTokenInfo = availableTokens.find(t => t.address.toLowerCase() === buyTokenAddress.toLowerCase());

                    const sellTokenDecimals = sellTokenInfo?.decimals || 18;
                    const buyTokenDecimals = buyTokenInfo?.decimals || 18;

                    const swapService = new SwapService(chainId);

                    // Use connected wallet address or a default address for quote
                    const userAddress = walletContext?.currentAddress || '0x0000000000000000000000000000000000000000';

                    const quote = await swapService.getQuote({
                        sellToken: sellTokenAddress,
                        buyToken: buyTokenAddress,
                        amount: action.amount!,
                        kind: action.amountType === 'sell' ? 'sell' : 'buy',
                        sellTokenDecimals,
                        buyTokenDecimals,
                        userAddress,
                    });

                    // Format amounts for display using CORRECT decimals
                    const { ethers } = await import('ethers');

                    console.log('Token Decimals Debug:', {
                        sellToken: action.sellToken,
                        buyToken: action.buyToken,
                        sellTokenDecimals,
                        buyTokenDecimals,
                        sellTokenAddress,
                        buyTokenAddress,
                        rawSellAmount: quote.quote.sellAmount,
                        rawBuyAmount: quote.quote.buyAmount
                    });

                    // Use the original requested amount for display, not the amount after fees
                    const formattedSellAmount = action.amount;
                    const formattedBuyAmount = ethers.formatUnits(quote.quote.buyAmount, buyTokenDecimals);
                    const formattedFeeAmount = ethers.formatUnits(quote.quote.feeAmount, sellTokenDecimals);

                    response.quote = {
                        ...quote,
                        formattedSellAmount,
                        formattedBuyAmount,
                        formattedFeeAmount,
                        sellTokenSymbol: sellTokenInfo?.symbol || 'UNKNOWN',
                        buyTokenSymbol: buyTokenInfo?.symbol || 'UNKNOWN',
                        sellTokenLogoURI: sellTokenInfo?.logoURI,
                        buyTokenLogoURI: buyTokenInfo?.logoURI,
                        sellTokenDecimals,
                        buyTokenDecimals,
                        requestAmount: action.amount // Store original request amount for refreshing
                    };
                    response.assistantMessage = assistantMessage + '\n\nQuote received! Review the details below and click "Accept Quote" to proceed.';
                } catch (error: any) {
                    console.error('Error getting quote:', error);
                    response.assistantMessage = `I encountered an error while fetching the quote: ${error.message}. Please check your parameters and try again.`;
                }
                break;

            case 'SUBMIT_ORDER':
                try {
                    // Check wallet connection
                    if (!walletContext?.currentAddress) {
                        response.assistantMessage = 'Please connect your wallet first to submit an order.';
                        response.requiredAction = 'REQUEST_WALLET_CONNECT';
                        break;
                    }

                    // Map network to chainId
                    const chainId = action.network === 'sepolia' ? 11155111 : 1;

                    // Create swap service for the network
                    const swapService = new SwapService(chainId);

                    // Submit order (this will require quote data from frontend)
                    // For now, we'll signal that the frontend should handle this
                    response.assistantMessage = assistantMessage;
                    response.requiredAction = 'SUBMIT_ORDER';
                } catch (error: any) {
                    console.error('Error submitting order:', error);
                    response.assistantMessage = `I encountered an error while submitting the order: ${error.message}. Please try again.`;
                }
                break;

            case 'CHECK_BALANCE':
                try {
                    // Check wallet connection
                    if (!walletContext?.currentAddress) {
                        response.assistantMessage = 'Please connect your wallet first to check your balance.';
                        response.requiredAction = 'REQUEST_WALLET_CONNECT';
                        break;
                    }

                    // Import ethers dynamically
                    const { ethers } = await import('ethers');

                    // Map network to chainId and RPC URL
                    const network = action.network || 'sepolia';
                    const chainId = network === 'sepolia' ? 11155111 : 1;
                    const rpcUrl = chainId === 11155111
                        ? CONFIG.RPC_URLS.SEPOLIA
                        : CONFIG.RPC_URLS.ETHEREUM;

                    // Create provider
                    const provider = new ethers.JsonRpcProvider(rpcUrl);

                    // Support both single token and multiple tokens
                    const tokens = action.tokens || (action.token ? [action.token] : []);

                    if (tokens.length === 0) {
                        response.assistantMessage = 'Please specify which token(s) you want to check.';
                        break;
                    }

                    const balanceResults: string[] = [];

                    for (const tokenInput of tokens) {
                        try {
                            let balance: bigint;
                            let decimals: number;
                            let symbol: string;

                            // Handle native ETH
                            if (tokenInput.toUpperCase() === 'ETH') {
                                balance = await provider.getBalance(walletContext.currentAddress);
                                decimals = 18;
                                symbol = 'ETH';
                            } else {
                                // Get token address - use directly if it starts with 0x, otherwise look it up
                                let tokenAddress = tokenInput.startsWith('0x') ? tokenInput : null;

                                // If not an address, try to find it in common tokens
                                if (!tokenAddress) {
                                    const tokenMap: { [key: string]: { ethereum: string, sepolia: string } } = {
                                        'WETH': { ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', sepolia: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' },
                                        'USDC': { ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', sepolia: '0xbe72E441BF55620febc26715db68d3494213D8Cb' },
                                        'DAI': { ethereum: '0x6B175474E89094C44Da98b954EedeAC495271d0F', sepolia: '0xB4F1737Af37711e9A5890D9510c9bB60e170CB0D' },
                                        'COW': { ethereum: '0xDEf1CA1fb7FBcDC777520aa7f396b4E015F497aB', sepolia: '0x0625aFB445C3B6B7B929342a04A22599fd5dBB59' },
                                        'GNO': { ethereum: '0x6810e776880C02933D47DB1b9fc05908e5386b96', sepolia: '0xd3f3d46FeBCD4CdAa2B83799b7A5CdcB69d135De' },
                                        'UNI': { ethereum: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', sepolia: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' }
                                    };
                                    tokenAddress = tokenMap[tokenInput.toUpperCase()]?.[network];
                                }

                                if (!tokenAddress) {
                                    balanceResults.push(`• **${tokenInput}**: Token not found on ${network}`);
                                    continue;
                                }

                                // Get balance using ERC20
                                const erc20Abi = [
                                    'function balanceOf(address) view returns (uint256)',
                                    'function decimals() view returns (uint8)',
                                    'function symbol() view returns (string)'
                                ];

                                const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
                                balance = await tokenContract.balanceOf(walletContext.currentAddress);
                                decimals = await tokenContract.decimals();
                                symbol = await tokenContract.symbol();
                            }

                            // Format balance
                            const formattedBalance = ethers.formatUnits(balance, decimals);
                            balanceResults.push(`• **${symbol}**: ${formattedBalance} ${symbol}`);
                        } catch (error: any) {
                            console.error(`Error checking balance for ${tokenInput}:`, error);
                            balanceResults.push(`• **${tokenInput}**: Error fetching balance`);
                        }
                    }

                    // Format the response based on number of tokens
                    if (tokens.length === 1) {
                        // Single token - simple format
                        const balanceInfo = balanceResults[0].replace('• **', '').replace('**:', ':');
                        response.assistantMessage = `${response.assistantMessage}\n\nYour ${balanceInfo}`;
                    } else {
                        // Multiple tokens - show as bulleted list
                        response.assistantMessage = `${response.assistantMessage}\n\n${balanceResults.join('\n')}`;
                    }

                } catch (error: any) {
                    console.error('Error checking balance:', error);
                    response.assistantMessage = `I encountered an error while checking the balance: ${error.message}. Please try again.`;
                }
                break;

            case 'REQUEST_ALLOWANCE':
                response.requiredAction = 'REQUEST_ALLOWANCE';
                break;

            case 'NO_ACTION':
            default:
                // Just return the message
                break;
        }

        console.log('Sending Response:', JSON.stringify(response, null, 2));
        res.json(response);
    } catch (error: any) {
        console.error('Error in agent controller:', error);
        res.status(500).json({
            error: error.message,
            assistantMessage: 'I apologize, but I encountered an unexpected error. Please try again.'
        });
    }
};
