import { Request, Response } from 'express';

import { CowSwapTokenProvider } from '../services/token/CowSwapTokenProvider';

const tokenProvider = new CowSwapTokenProvider();

export const getTokens = async (req: Request, res: Response) => {
    try {
        const chainId = parseInt(req.query.chainId as string) || 1;
        const tokens = await tokenProvider.getTokens(chainId);
        res.json(tokens);
    } catch (error) {
        console.error('Error in getTokens controller:', error);
        res.status(500).json({ error: 'Failed to fetch tokens' });
    }
};
