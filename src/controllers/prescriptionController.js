import { body } from 'express-validator';
import { Appointment } from '../models/Appointment.js';
import { Prescription } from '../models/Prescription.js';
import { generatePrescriptionPdf } from '../services/prescriptionPdfService.js';
import { sendWhatsAppDocument } from '../services/whatsappService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const prescriptionValidation = [
  body('appointmentId').isMongoId(),
  body('diagnosis').trim().isLength({ min: 2 }),
  body('medicines').isArray(),
  body('medicines.*.name').trim().isLength({ min: 1 })
];

export const createPrescription = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.body.appointmentId).populate('patient');
  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }
  let prescription = await Prescription.findOneAndUpdate(
    { appointment: appointment._id },
    {
      patient: appointment.patient._id,
      diagnosis: req.body.diagnosis,
      medicines: req.body.medicines,
      instructions: req.body.instructions,
      testsSuggested: req.body.testsSuggested || [],
      followUpDate: req.body.followUpDate
    },
    { new: true, upsert: true, runValidators: true }
  );
  const pdf = await generatePrescriptionPdf({ appointment, prescription });
  prescription.pdfUrl = pdf.url;
  prescription.pdfStorageKey = pdf.key;
  prescription.generatedAt = new Date();
  await prescription.save();
  appointment.prescription = prescription._id;
  if (appointment.status !== 'completed') appointment.status = 'completed';
  await appointment.save();
  sendSuccess(res, prescription, 'Prescription saved and PDF generated', 201);
});

export const getAdminPrescriptions = asyncHandler(async (req, res) => {
  const prescriptions = await Prescription.find().populate('patient appointment').sort({ createdAt: -1 });
  sendSuccess(res, prescriptions);
});

export const sendPrescriptionWhatsapp = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id).populate('patient appointment');
  if (!prescription || !prescription.pdfUrl) {
    const error = new Error('Generated prescription PDF not found');
    error.statusCode = 404;
    throw error;
  }
  const response = await sendWhatsAppDocument({
    patient: prescription.patient,
    appointment: prescription.appointment,
    prescription,
    documentUrl: prescription.pdfUrl
  });
  prescription.sentOnWhatsappAt = new Date();
  await prescription.save();
  sendSuccess(res, { response, prescription }, 'Prescription sent on WhatsApp');
});
