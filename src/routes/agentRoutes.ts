import { Router } from 'express';
import { sendMessage } from '../controllers/agentController';

const router = Router();

router.post('/message', sendMessage);

export default router;
