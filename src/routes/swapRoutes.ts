import { Router } from 'express';
import { getQuote, submitOrder } from '../controllers/swapController';
import { getOrderStatus } from '../controllers/orderController';

const router = Router();

router.post('/quote', getQuote);
router.post('/orders', submitOrder);
router.get('/orders/:orderUid', getOrderStatus);

export default router;
