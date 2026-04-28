import express from 'express';
import { endCall, endCallValidation, fetchRecordingUrl, getAdminRtcToken, getPatientRtcToken, getRecordingStatus, startCall, startCallValidation, tokenValidation } from '../controllers/agoraController.js';
import { protectPatient } from '../middleware/authMiddleware.js';
import { protectAdmin } from '../middleware/adminMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

export const agoraRoutes = express.Router();

agoraRoutes.get('/patient/token/:appointmentId', protectPatient, tokenValidation, validateRequest, getPatientRtcToken);
agoraRoutes.get('/admin/token/:appointmentId', protectAdmin, tokenValidation, validateRequest, getAdminRtcToken);
agoraRoutes.post('/admin/start-call', protectAdmin, startCallValidation, validateRequest, startCall);
agoraRoutes.post('/admin/end-call', protectAdmin, endCallValidation, validateRequest, endCall);
agoraRoutes.get('/admin/recording/:appointmentId', protectAdmin, tokenValidation, validateRequest, fetchRecordingUrl);
agoraRoutes.get('/admin/recording-status/:appointmentId', protectAdmin, tokenValidation, validateRequest, getRecordingStatus);
