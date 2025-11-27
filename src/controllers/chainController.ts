import { Request, Response } from 'express';
import { SUPPORTED_CHAINS } from '../config/chains';

export const getSupportedChains = async (req: Request, res: Response) => {
    try {
        res.json(SUPPORTED_CHAINS);
    } catch (error: any) {
        console.error('Error getting supported chains:', error);
        res.status(500).json({ error: error.message });
    }
};
