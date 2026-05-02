import { body, param } from 'express-validator';
import { Symptom } from '../models/Symptom.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const symptomValidation = [
  body('name').trim().isLength({ min: 2 }).withMessage('Symptom name is required'),
  body('description').optional().isString(),
  body('isActive').optional().isBoolean(),
  body('sortOrder').optional().isInt({ min: 0 })
];

export const symptomIdValidation = [param('id').isMongoId()];

export const listPublicSymptoms = asyncHandler(async (req, res) => {
  const symptoms = await Symptom.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
  sendSuccess(res, symptoms);
});

export const listAdminSymptoms = asyncHandler(async (req, res) => {
  const symptoms = await Symptom.find().sort({ sortOrder: 1, name: 1 });
  sendSuccess(res, symptoms);
});

export const createSymptom = asyncHandler(async (req, res) => {
  const symptom = await Symptom.create({
    name: req.body.name,
    description: req.body.description || '',
    isActive: req.body.isActive ?? true,
    sortOrder: req.body.sortOrder || 0
  });
  sendSuccess(res, symptom, 'Symptom created', 201);
});

export const updateSymptom = asyncHandler(async (req, res) => {
  const update = {};
  ['name', 'description', 'isActive', 'sortOrder'].forEach((key) => {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  });
  const symptom = await Symptom.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true
  });
  if (!symptom) {
    const error = new Error('Symptom not found');
    error.statusCode = 404;
    throw error;
  }
  sendSuccess(res, symptom, 'Symptom updated');
});

export const deleteSymptom = asyncHandler(async (req, res) => {
  const symptom = await Symptom.findByIdAndDelete(req.params.id);
  if (!symptom) {
    const error = new Error('Symptom not found');
    error.statusCode = 404;
    throw error;
  }
  sendSuccess(res, symptom, 'Symptom deleted');
});
