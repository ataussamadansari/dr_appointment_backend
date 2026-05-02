import express from 'express';
import {
  createSymptom,
  deleteSymptom,
  listAdminSymptoms,
  listPublicSymptoms,
  symptomIdValidation,
  symptomValidation,
  updateSymptom
} from '../controllers/symptomController.js';
import { protectAdmin } from '../middleware/adminMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

export const symptomRoutes = express.Router();

symptomRoutes.get('/', listPublicSymptoms);
symptomRoutes.get('/admin', protectAdmin, listAdminSymptoms);
symptomRoutes.post('/admin', protectAdmin, symptomValidation, validateRequest, createSymptom);
symptomRoutes.put('/admin/:id', protectAdmin, symptomIdValidation, symptomValidation, validateRequest, updateSymptom);
symptomRoutes.delete('/admin/:id', protectAdmin, symptomIdValidation, validateRequest, deleteSymptom);
