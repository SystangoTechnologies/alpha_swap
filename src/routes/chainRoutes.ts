import { Router } from 'express';
import { getSupportedChains } from '../controllers/chainController';

const router = Router();

router.get('/', getSupportedChains);

export default router;
