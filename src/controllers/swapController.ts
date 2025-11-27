import { Request, Response } from 'express';
import { SwapService } from '../services/swapService';


export const getQuote = async (req: Request, res: Response) => {
    try {
        const { sellToken, buyToken, amount, kind, sellTokenDecimals, buyTokenDecimals, userAddress, chainId } = req.body;

        // Validate required fields
        if (!sellToken || !buyToken || !amount || !kind || !userAddress || !chainId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const swapService = new SwapService(chainId);

        const quote = await swapService.getQuote({
            sellToken,
            buyToken,
            amount,
            kind,
            sellTokenDecimals: sellTokenDecimals || 18,
            buyTokenDecimals: buyTokenDecimals || 18,
            userAddress,
        });

        res.json(quote);
    } catch (error: any) {
        console.error('Error getting quote:', error);
        res.status(500).json({ error: error.message || 'Failed to get quote' });
    }
};


export const submitOrder = async (req: Request, res: Response) => {
    try {
        const params = req.body;
        const chainId = params.chainId || 1; // Default to Mainnet if not provided

        // Create SwapService with the correct chainId
        const swapService = new SwapService(chainId);

        const orderId = await swapService.submitOrder(params);
        res.json({ orderId });
    } catch (error: any) {
        console.error('Error submitting order:', error);
        res.status(500).json({ error: error.message });
    }
};
