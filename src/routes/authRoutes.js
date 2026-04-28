import express from 'express';
import { adminLogin, adminLoginValidation, sendOtpValidation, sendPatientOtp, verifyOtpValidation, verifyPatientOtp } from '../controllers/authController.js';
import { validateRequest } from '../middleware/validateRequest.js';

export const authRoutes = express.Router();

authRoutes.post('/send-otp', sendOtpValidation, validateRequest, sendPatientOtp);
authRoutes.post('/verify-otp', verifyOtpValidation, validateRequest, verifyPatientOtp);
authRoutes.post('/admin/login', adminLoginValidation, validateRequest, adminLogin);
