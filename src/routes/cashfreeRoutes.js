import express from 'express';
import { cashfreeHealth, cashfreeWebhook } from '../controllers/cashfreeController.js';

export const cashfreeRoutes = express.Router();

cashfreeRoutes.get('/health', cashfreeHealth);
cashfreeRoutes.post('/webhook', cashfreeWebhook);
