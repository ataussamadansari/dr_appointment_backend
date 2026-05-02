import express from 'express';
import { body } from 'express-validator';
import { interaktHealth, interaktWebhook, sendInteraktTestMessage } from '../controllers/interaktController.js';
import { protectAdmin } from '../middleware/adminMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

export const interaktRoutes = express.Router();

interaktRoutes.get('/health', interaktHealth);
interaktRoutes.post('/webhook', interaktWebhook);
interaktRoutes.post(
  '/send-test-message',
  protectAdmin,
  [body('phone').notEmpty(), body('message').optional().isString()],
  validateRequest,
  sendInteraktTestMessage
);
