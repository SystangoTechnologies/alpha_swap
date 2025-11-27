import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, type Signer, ethers } from 'ethers';
import { TradingSdk } from '@cowprotocol/cow-sdk';
import { EthersV6Adapter } from '@cowprotocol/sdk-ethers-v6-adapter';
import { AdapterContext } from '@cowprotocol/sdk-common';
import { swapApi } from '../api/swapApi';

export interface CowHook {
    provider: BrowserProvider | null;
    signer: Signer | null;
    chainId: number | null;
    account: string | null;
    sdk: TradingSdk | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    getQuote: (sellToken: string, buyToken: string, amount: string, kind: 'sell' | 'buy', sellTokenDecimals: number, buyTokenDecimals: number, chainIdOverride?: number) => Promise<any>;
    placeOrder: (quote: any) => Promise<string>;
}

export const useCowSdk = (): CowHook => {
    const [provider, setProvider] = useState<BrowserProvider | null>(null);
    const [signer, setSigner] = useState<Signer | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [account, setAccount] = useState<string | null>(null);
    const [sdk, setSdk] = useState<TradingSdk | null>(null);

    const connect = useCallback(async () => {
        const ethereum = (window as any).ethereum;
        if (ethereum) {
            try {
                await ethereum.request({ method: 'eth_requestAccounts' });
                const provider = new ethers.BrowserProvider(ethereum);
                const signer = await provider.getSigner();
                const network = await provider.getNetwork();
                const account = await signer.getAddress();

                setProvider(provider);
                setSigner(signer);
                setChainId(Number(network.chainId));
                setAccount(account);

                // Initialize SDK
                const adapter = new EthersV6Adapter({
                    provider,
                    signer,
                });
                AdapterContext.getInstance().setAdapter(adapter);

                const sdkInstance = new TradingSdk({
                    chainId: Number(network.chainId),
                    signer,
                    appCode: 'CoW Swap',
                });
                setSdk(sdkInstance);

            } catch (error) {
                console.error("Failed to connect wallet:", error);
            }
        } else {
            alert("Please install Metamask!");
        }
    }, []);

    const disconnect = useCallback(() => {
        setProvider(null);
        setSigner(null);
        setChainId(null);
        setAccount(null);
        setSdk(null);
    }, []);

    const getQuote = useCallback(async (
        sellToken: string,
        buyToken: string,
        amount: string,
        kind: 'sell' | 'buy',
        sellTokenDecimals: number,
        buyTokenDecimals: number,
        chainIdOverride?: number
    ) => {
        // Use chainIdOverride if provided, otherwise use connected chainId or default to Mainnet (1)
        const activeChainId = chainIdOverride ?? chainId ?? 1;
        // Use connected account or default to ZeroAddress (for simulations)
        const activeAccount = account || ethers.ZeroAddress;

        // Call Backend API with chainId
        const response = await swapApi.getQuote({
            sellToken,
            buyToken,
            amount,
            kind,
            sellTokenDecimals,
            buyTokenDecimals,
            userAddress: activeAccount,
            chainId: activeChainId // Pass chainId to backend
        });
        return response;
    }, [account, chainId]);

    const placeOrder = useCallback(async (quoteResponse: any) => {
        if (!sdk || !signer || !chainId) throw new Error("SDK not initialized");

        // quoteResponse is now the OrderQuoteResponse from OrderBookApi
        const quote = quoteResponse.quote;

        if (!quote) throw new Error("Invalid quote response: missing quote");

        // Calculate slippage
        // We use a dynamic slippage model:
        // - 1% (100bps) for volatile pairs or testnet (Sepolia)
        // - 0.5% (50bps) for standard pairs on Mainnet
        const getSlippageBps = (chainId: number) => {
            if (chainId === 11155111) {
                return 100n; // 1% for Sepolia
            }
            return 50n; // 0.5% for Mainnet/others
        };

        const SLIPPAGE_BPS = getSlippageBps(chainId);
        const BPS_BASE = 10000n;

        let sellAmount = quote.sellAmount;
        let buyAmount = quote.buyAmount;

        // IMPORTANT: For CoW Protocol v2 signed orders with feeAmount=0 (surplus capturing),
        // the sellAmount must include the fee!
        // The quote returns sellAmount (net) and feeAmount separately.
        // We must add them together so the solver has the full amount to cover gas.

        if (quote.kind === 'sell') {
            // Total Sell Amount = Quote Sell Amount + Quote Fee Amount
            const totalSellAmount = BigInt(quote.sellAmount) + BigInt(quote.feeAmount);
            sellAmount = totalSellAmount.toString();

            // Calculate minimum buy amount with slippage
            // We apply slippage to the quoted buyAmount
            const quotedBuyAmount = BigInt(quote.buyAmount);
            const minBuyAmount = quotedBuyAmount * (BPS_BASE - SLIPPAGE_BPS) / BPS_BASE;
            buyAmount = minBuyAmount.toString();
        } else {
            // For BUY orders: We are willing to pay up to (sellAmount * (1 + slippage))
            // sellAmount is the quoted cost
            const quotedSellAmount = BigInt(quote.sellAmount);
            const maxSellAmount = quotedSellAmount * (BPS_BASE + SLIPPAGE_BPS) / BPS_BASE;
            sellAmount = maxSellAmount.toString();

            // For buy orders, fee is usually taken from sell token too, 
            // but the logic is slightly different. For now, we focus on fixing the SELL case
            // which is the primary use case here.
        }

        // Construct order from quote (matching reference implementation)
        const order = {
            sellToken: quote.sellToken,
            buyToken: quote.buyToken,
            receiver: account, // Ensure receiver is set to user
            sellAmount: sellAmount, // Now includes fee!
            buyAmount: buyAmount,
            validTo: quote.validTo,
            appData: quote.appData,
            feeAmount: '0', // Fee must be zero for CoW Swap orders (surplus capturing)
            kind: quote.kind,
            partiallyFillable: quote.partiallyFillable,
            sellTokenBalance: quote.sellTokenBalance,
            buyTokenBalance: quote.buyTokenBalance,
            quoteId: quoteResponse.id // Include quoteId to link order to quote
        };

        // We need the domain.
        const domain = {
            name: 'Gnosis Protocol',
            version: 'v2',
            chainId,
            verifyingContract: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41' // Mainnet/Sepolia/etc. need correct address
        };

        // TODO: verifyingContract address varies by chain.
        // The SDK has this mapping. 
        // For now, let's try to get it from the SDK instance if possible, or hardcode for Mainnet/Sepolia.
        if (chainId === 11155111) {
            domain.verifyingContract = '0x9008D19f58AAbD9eD0D60971565AA8510560ab41'; // Sepolia
        } else {
            domain.verifyingContract = '0x9008D19f58AAbD9eD0D60971565AA8510560ab41'; // Mainnet
        }

        const types = {
            Order: [
                { name: "sellToken", type: "address" },
                { name: "buyToken", type: "address" },
                { name: "receiver", type: "address" },
                { name: "sellAmount", type: "uint256" },
                { name: "buyAmount", type: "uint256" },
                { name: "validTo", type: "uint32" },
                { name: "appData", type: "bytes32" },
                { name: "feeAmount", type: "uint256" },
                { name: "kind", type: "string" },
                { name: "partiallyFillable", type: "bool" },
                { name: "sellTokenBalance", type: "string" },
                { name: "buyTokenBalance", type: "string" },
            ]
        };

        const signature = await signer.signTypedData(domain, types, order);

        // Submit to Backend with chainId
        const orderId = await swapApi.submitOrder({
            quote: order,
            signature,
            chainId, // Pass chainId to backend
            quoteId: quoteResponse.id, // Pass quoteId from response
            from: account || ethers.ZeroAddress // Pass user address
        });

        return orderId.orderId;
    }, [sdk, signer, chainId, account]);

    useEffect(() => {
        const ethereum = (window as any).ethereum;
        if (ethereum) {
            // Auto-connect if already connected
            ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
                if (accounts.length > 0) {
                    connect();
                }
            });

            ethereum.on('accountsChanged', () => {
                window.location.reload();
            });
            ethereum.on('chainChanged', () => {
                window.location.reload();
            });
        }
    }, [connect]);

    return {
        provider,
        signer,
        chainId,
        account,
        sdk,
        connect,
        disconnect,
        getQuote,
        placeOrder
    };
};
