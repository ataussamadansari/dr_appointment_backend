import express from 'express';
import { confirmationValidation, sendBookingConfirmation } from '../controllers/whatsappController.js';
import { protectAdmin } from '../middleware/adminMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

export const whatsappRoutes = express.Router();

whatsappRoutes.use(protectAdmin);
whatsappRoutes.post('/booking-confirmation', confirmationValidation, validateRequest, sendBookingConfirmation);
