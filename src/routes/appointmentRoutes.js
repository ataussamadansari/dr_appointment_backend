import express from 'express';
import { createAppointment, createAppointmentValidation, getNextDaySlots } from '../controllers/appointmentController.js';
import { protectPatient } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

export const appointmentRoutes = express.Router();

appointmentRoutes.use(protectPatient);
appointmentRoutes.get('/next-day-slots', getNextDaySlots);
appointmentRoutes.post('/', createAppointmentValidation, validateRequest, createAppointment);