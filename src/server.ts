import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import swapRoutes from './routes/swapRoutes';
import tokenRoutes from './routes/tokenRoutes';
import chainRoutes from './routes/chainRoutes';
import agentRoutes from './routes/agentRoutes';
import { adminController } from './controllers/adminController';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.method !== 'GET' && req.body) {
        console.log('Request Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

app.use('/api/swap', swapRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/chains', chainRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/admin', adminController);

app.get('/health', (req, res) => {
    res.send('OK');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
