import express from 'express';
import { createOrderValidation, createPaymentOrder, verifyPayment, verifyPaymentValidation } from '../controllers/paymentController.js';
import { protectPatient } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

export const paymentRoutes = express.Router();

paymentRoutes.use(protectPatient);
paymentRoutes.post('/order', createOrderValidation, validateRequest, createPaymentOrder);
paymentRoutes.post('/verify', verifyPaymentValidation, validateRequest, verifyPayment);
