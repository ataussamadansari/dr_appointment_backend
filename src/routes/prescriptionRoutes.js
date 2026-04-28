import express from 'express';
import { createPrescription, getAdminPrescriptions, prescriptionValidation, sendPrescriptionWhatsapp } from '../controllers/prescriptionController.js';
import { protectAdmin } from '../middleware/adminMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

export const prescriptionRoutes = express.Router();

prescriptionRoutes.use(protectAdmin);
prescriptionRoutes.get('/', getAdminPrescriptions);
prescriptionRoutes.post('/', prescriptionValidation, validateRequest, createPrescription);
prescriptionRoutes.post('/:id/send-whatsapp', sendPrescriptionWhatsapp);
