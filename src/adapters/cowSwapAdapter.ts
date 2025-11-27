import { ISwapAdapter, QuoteParams, OrderParams } from './interfaces/ISwapAdapter';
import { CONFIG } from '../config';
import { TradingSdk, SupportedChainId, OrderKind, OrderBookApi } from '@cowprotocol/cow-sdk';
import { ethers } from 'ethers';

import { EthersV6Adapter } from '@cowprotocol/sdk-ethers-v6-adapter';
import { AdapterContext } from '@cowprotocol/sdk-common';

export class CowSwapAdapter implements ISwapAdapter {
    private sdk: TradingSdk;
    private orderBookApi: OrderBookApi;
    private chainId: SupportedChainId;

    constructor(chainId: SupportedChainId = SupportedChainId.MAINNET) {
        this.chainId = chainId;

        // Initialize Provider
        // Initialize Provider
        const rpcUrl = chainId === SupportedChainId.SEPOLIA
            ? CONFIG.RPC_URLS.SEPOLIA
            : CONFIG.RPC_URLS.ETHEREUM; // Default to Mainnet public RPC

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const signer = ethers.Wallet.createRandom(provider);

        const adapter = new EthersV6Adapter({
            provider,
            signer,
        });
        AdapterContext.getInstance().setAdapter(adapter);

        this.sdk = new TradingSdk({
            chainId,
            signer,
            appCode: 'CoW Swap',
        });
        this.orderBookApi = new OrderBookApi({ chainId });
    }

    async getQuote(params: QuoteParams): Promise<any> {
        const { sellToken, buyToken, amount, kind, sellTokenDecimals, buyTokenDecimals, userAddress } = params;

        console.log('CowSwapAdapter.getQuote params:', { sellToken, buyToken, amount, sellTokenDecimals, buyTokenDecimals });

        const amountBigInt = ethers.parseUnits(amount, kind === 'sell' ? sellTokenDecimals : buyTokenDecimals);

        console.log('Parsed amount:', { amount, decimals: kind === 'sell' ? sellTokenDecimals : buyTokenDecimals, amountBigInt: amountBigInt.toString() });

        // Check if selling native ETH
        const isNativeEth = sellToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

        // WETH addresses for different chains
        const WETH_ADDRESSES: { [chainId: number]: string } = {
            1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',      // Mainnet
            11155111: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // Sepolia
            100: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',     // Gnosis
            42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',   // Arbitrum
            8453: '0x4200000000000000000000000000000000000006',    // Base
        };

        // If selling native ETH, use WETH address but set sellTokenBalance to 'external'
        const actualSellToken = isNativeEth ? WETH_ADDRESSES[this.chainId] : sellToken;

        const quoteRequest = {
            sellToken: actualSellToken,
            buyToken,
            from: userAddress,
            receiver: userAddress,
            validTo: Math.floor(Date.now() / 1000) + 3600, // 1 hour
            appData: '0x0000000000000000000000000000000000000000000000000000000000000000', // Zero hash to match reference implementation
            partiallyFillable: false,
            // For native ETH (Eth-flow), we use WETH address with 'erc20' balance type
            // The 'external' value is for Balancer vault integration, not Eth-flow
            sellTokenBalance: 'erc20',
            buyTokenBalance: 'erc20',
            kind: kind === 'sell' ? OrderKind.SELL : OrderKind.BUY,
            signingScheme: 'eip712', // SigningScheme.EIP712
        };

        if (kind === 'sell') {
            (quoteRequest as any).sellAmountBeforeFee = amountBigInt.toString();
        } else {
            (quoteRequest as any).buyAmountAfterFee = amountBigInt.toString();
        }

        console.log('Quote request to CoW API:', JSON.stringify(quoteRequest, null, 2));

        const quoteResponse = await this.orderBookApi.getQuote(quoteRequest as any);

        console.log('Quote response from CoW API:', JSON.stringify(quoteResponse, null, 2));

        return quoteResponse;
    }

    async submitOrder(params: OrderParams): Promise<string> {
        const { quote, signature, quoteId, from } = params;

        // The quote object passed here is the orderToSign from the quote response
        // We need to combine it with the signature, quoteId, and from address
        // to match what the CoW Protocol API expects.

        const orderUid = await this.orderBookApi.sendOrder({
            ...quote, // This contains sellToken, buyToken, amounts, validTo, appData, etc.
            from,     // The user's address
            quoteId,  // The quote ID to link this order to the quote (validating appData)
            signature,
            signingScheme: 'eip712',
        });

        return orderUid;
    }

    async getOrderStatus(orderUid: string): Promise<any> {
        try {
            const order = await this.orderBookApi.getOrder(orderUid);
            return order;
        } catch (error) {
            console.error('Error fetching order status:', error);
            throw error;
        }
    }
}
