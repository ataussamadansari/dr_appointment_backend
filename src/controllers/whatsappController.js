import { body } from 'express-validator';
import { Appointment } from '../models/Appointment.js';
import { sendWhatsAppText } from '../services/whatsappService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const confirmationValidation = [body('appointmentId').isMongoId()];

export const sendBookingConfirmation = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.body.appointmentId).populate('patient');
  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }
  const response = await sendWhatsAppText({
    patient: appointment.patient,
    appointment,
    type: 'booking_confirmation',
    text: `Your consultation booking has been created for ${appointment.appointmentDate.toDateString()} ${appointment.slotStart}. Please complete payment to confirm.`
  });
  sendSuccess(res, response, 'Booking confirmation sent');
});
