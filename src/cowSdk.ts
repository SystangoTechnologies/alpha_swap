
import { TradingSdk, SupportedChainId, OrderKind } from '@cowprotocol/cow-sdk';
import { EthersV6Adapter } from '@cowprotocol/sdk-ethers-v6-adapter';
import { AdapterContext } from '@cowprotocol/sdk-common';
import { wallet, provider } from './config';
import { ethers } from 'ethers';

export class CowBot {
    private sdk: TradingSdk;

    constructor(chainId: SupportedChainId = SupportedChainId.MAINNET, rpcUrl?: string, privateKey?: string) {
        // If rpcUrl/privateKey are provided, create new provider/wallet
        // Otherwise use the default ones from config (which might be mainnet)

        let currentProvider = provider;
        let currentWallet = wallet;

        if (rpcUrl) {
            currentProvider = new ethers.JsonRpcProvider(rpcUrl);
            if (privateKey) {
                currentWallet = new ethers.Wallet(privateKey, currentProvider);
            } else if (process.env.PRIVATE_KEY) {
                currentWallet = new ethers.Wallet(process.env.PRIVATE_KEY, currentProvider);
            } else {
                // Random wallet if no key
                currentWallet = ethers.Wallet.createRandom(currentProvider);
            }
        }

        const adapter = new EthersV6Adapter({
            provider: currentProvider,
            signer: currentWallet,
        });
        AdapterContext.getInstance().setAdapter(adapter);

        this.sdk = new TradingSdk({
            chainId,
            signer: currentWallet,
            appCode: 'CowSwapBot',
        });
    }

    async getQuote(
        sellToken: string,
        buyToken: string,
        amount: string, // Human readable amount
        kind: 'sell' | 'buy',
        sellTokenDecimals: number = 18,
        buyTokenDecimals: number = 18
    ) {
        const amountBigInt = ethers.parseUnits(amount, kind === 'sell' ? sellTokenDecimals : buyTokenDecimals);

        const params = {
            sellToken,
            buyToken,
            kind: kind === 'sell' ? OrderKind.SELL : OrderKind.BUY,
            amount: amountBigInt.toString(),
            sellTokenDecimals,
            buyTokenDecimals,
            userAddress: wallet.address,
        };

        const quoteAndPost = await this.sdk.getQuote(params);
        return quoteAndPost;
    }

    async placeOrder(
        sellToken: string,
        buyToken: string,
        amount: string,
        kind: 'sell' | 'buy',
        sellTokenDecimals: number = 18,
        buyTokenDecimals: number = 18,
        minBuyAmount?: string // Optional for limit orders
    ) {
        if (minBuyAmount) {
            // Limit Order
            if (kind !== 'sell') {
                throw new Error('Limit orders currently only supported for SELL side (specifying sell amount and min buy amount)');
            }

            const sellAmountRaw = ethers.parseUnits(amount, sellTokenDecimals);
            const buyAmountRaw = ethers.parseUnits(minBuyAmount, buyTokenDecimals);

            const orderId = await this.sdk.postLimitOrder({
                sellToken,
                buyToken,
                sellTokenDecimals,
                buyTokenDecimals,
                sellAmount: sellAmountRaw.toString(),
                buyAmount: buyAmountRaw.toString(),
                kind: OrderKind.SELL,
            });
            return orderId.orderId;
        } else {
            // Market Order (Swap)
            const quoteAndPost = await this.getQuote(sellToken, buyToken, amount, kind, sellTokenDecimals, buyTokenDecimals);

            // Execute the swap based on the quote
            const result = await quoteAndPost.postSwapOrderFromQuote();
            return result.orderId;
        }
    }
}
