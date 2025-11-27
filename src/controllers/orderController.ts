import { Request, Response } from 'express';
import { SwapService } from '../services/swapService';

export const getOrderStatus = async (req: Request, res: Response) => {
    try {
        const { orderUid } = req.params;
        const chainId = parseInt(req.query.chainId as string) || 1; // Default to Mainnet if not provided

        if (!orderUid) {
            return res.status(400).json({ error: 'Order UID is required' });
        }

        const swapService = new SwapService(chainId);
        const orderStatus = await swapService.getOrderStatus(orderUid);

        res.json(orderStatus);
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ error: 'Failed to fetch order status' });
    }
};
