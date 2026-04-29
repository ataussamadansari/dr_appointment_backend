import express from 'express';
import { getAdminProfile, getPublicProfile, updateDoctorProfile } from '../controllers/doctorProfileController.js';
import { protectAdmin } from '../middleware/adminMiddleware.js';

export const doctorProfileRoutes = express.Router();

// Public — patients can fetch doctor info without auth
doctorProfileRoutes.get('/public', getPublicProfile);

// Admin — manage profile
doctorProfileRoutes.get('/', protectAdmin, getAdminProfile);
doctorProfileRoutes.put('/', protectAdmin, updateDoctorProfile);
