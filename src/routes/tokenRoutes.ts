import { Router } from 'express';
import { getTokens } from '../controllers/tokenController';

const router = Router();

router.get('/', getTokens);

export default router;
