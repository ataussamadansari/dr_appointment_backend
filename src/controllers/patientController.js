import { body } from 'express-validator';
import { Appointment } from '../models/Appointment.js';
import { Prescription } from '../models/Prescription.js';
import { resolveStoredFileUrl } from '../services/storageService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const profileValidation = [
  body('name').optional().trim().isLength({ min: 2 }),
  body('age').optional().isInt({ min: 0, max: 120 }),
  body('city').optional().trim().isLength({ min: 2 }),
  body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say'])
];

export const getProfile = asyncHandler(async (req, res) => {
  sendSuccess(res, req.patient);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const fields = ['name', 'age', 'city', 'gender'];
  fields.forEach((field) => {
    if (req.body[field] !== undefined) req.patient[field] = req.body[field];
  });
  await req.patient.save();
  sendSuccess(res, req.patient, 'Profile updated');
});

export const getMyAppointments = asyncHandler(async (req, res) => {
  const appointments = await Appointment.find({ patient: req.patient._id })
    .populate('prescription', 'pdfUrl diagnosis generatedAt')
    .populate('symptomIds', 'name description')
    .sort({ appointmentDate: -1, createdAt: -1 });
  const rows = await Promise.all(appointments.map(async (appointment) => {
    const row = appointment.toObject();
    row.prescriptionPhotoUrl = await resolveStoredFileUrl({
      key: appointment.prescriptionPhotoKey,
      url: appointment.prescriptionPhotoUrl
    });
    return row;
  }));
  sendSuccess(res, rows);
});

export const getMyPrescriptions = asyncHandler(async (req, res) => {
  const prescriptions = await Prescription.find({ patient: req.patient._id })
    .populate('appointment', 'appointmentDate tokenNumber status')
    .sort({ createdAt: -1 });
  sendSuccess(res, prescriptions);
});

export const updateFcmToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  req.patient.fcmToken = fcmToken || null;
  await req.patient.save();
  sendSuccess(res, {}, 'FCM token updated');
});
