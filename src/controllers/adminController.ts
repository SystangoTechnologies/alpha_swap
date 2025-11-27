import { Request, Response, Router } from 'express';
import { TokenService } from '../services/token/TokenService';

const router = Router();
const tokenService = new TokenService();

// POST /api/admin/tokens/refresh
router.post('/tokens/refresh', async (req: Request, res: Response) => {
    try {
        // Basic security check (can be enhanced later)
        // For now, we assume this is an internal/admin endpoint
        // You could check for a specific header or API key here if needed

        const result = await tokenService.refreshTokens();

        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('Error in admin refresh tokens:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

export const adminController = router;
