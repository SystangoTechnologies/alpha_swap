import { Request, Response } from 'express';
import { TokenService } from '../services/token/TokenService';
import { CowSwapTokenProvider } from '../services/token/CowSwapTokenProvider';

const tokenProvider = new CowSwapTokenProvider();
const tokenService = new TokenService(tokenProvider);

export const getTokens = async (req: Request, res: Response) => {
    try {
        const chainId = parseInt(req.query.chainId as string) || 1;
        const tokens = await tokenService.getTokens(chainId);
        res.json(tokens);
    } catch (error) {
        console.error('Error in getTokens controller:', error);
        res.status(500).json({ error: 'Failed to fetch tokens' });
    }
};
