import express from 'express';
import {
  appointmentDetail, dashboardStats, getDoctorProfile, getNextDaySlots,
  getSettings, listAppointments, listRecordings, settingValidation,
  statusValidation, updateAppointmentStatus, updateDoctorProfile, updateSettings
} from '../controllers/adminController.js';
import { protectAdmin } from '../middleware/adminMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

export const adminRoutes = express.Router();

adminRoutes.use(protectAdmin);
adminRoutes.get('/dashboard', dashboardStats);
adminRoutes.get('/settings', getSettings);
adminRoutes.put('/settings', settingValidation, validateRequest, updateSettings);
adminRoutes.get('/next-day-slots', getNextDaySlots);
adminRoutes.get('/appointments', listAppointments);
adminRoutes.get('/appointments/:id', appointmentDetail);
adminRoutes.patch('/appointments/:id/status', statusValidation, validateRequest, updateAppointmentStatus);
adminRoutes.get('/recordings', listRecordings);
adminRoutes.get('/doctor-profile', getDoctorProfile);
adminRoutes.put('/doctor-profile', updateDoctorProfile);
