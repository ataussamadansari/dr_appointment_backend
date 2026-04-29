import express from 'express';
import { getMyAppointments, getMyPrescriptions, getProfile, profileValidation, updateFcmToken, updateProfile } from '../controllers/patientController.js';
import { getDoctorProfile } from '../controllers/adminController.js';
import { protectPatient } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

export const patientRoutes = express.Router();

patientRoutes.use(protectPatient);
patientRoutes.get('/profile', getProfile);
patientRoutes.put('/profile', profileValidation, validateRequest, updateProfile);
patientRoutes.get('/appointments', getMyAppointments);
patientRoutes.get('/prescriptions', getMyPrescriptions);
patientRoutes.post('/fcm-token', updateFcmToken);
patientRoutes.get('/doctor-profile', getDoctorProfile); // public doctor info for patients
