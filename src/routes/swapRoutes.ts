import { Router } from 'express';
import { getQuote, submitOrder } from '../controllers/swapController';

const router = Router();

router.post('/quote', getQuote);
router.post('/order', submitOrder);

export default router;
