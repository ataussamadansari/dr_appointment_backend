import { body } from 'express-validator';
import { Appointment } from '../models/Appointment.js';
import { Payment } from '../models/Payment.js';
import { createRazorpayOrder, verifyRazorpaySignature } from '../services/razorpayService.js';
import { sendWhatsAppText } from '../services/whatsappService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { emit } from '../config/socket.js';

export const createOrderValidation = [body('appointmentId').isMongoId()];
export const verifyPaymentValidation = [
  body('appointmentId').isMongoId(),
  body('razorpayOrderId').notEmpty(),
  body('razorpayPaymentId').notEmpty(),
  body('razorpaySignature').notEmpty()
];

export const createPaymentOrder = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findOne({ _id: req.body.appointmentId, patient: req.patient._id });
  if (!appointment || appointment.status !== 'payment_pending') {
    const error = new Error('Payment can be created only for a pending appointment');
    error.statusCode = 400;
    throw error;
  }
  const order = await createRazorpayOrder({ amount: appointment.feeAmount, receipt: `appt_${appointment._id}` });
  const payment = await Payment.create({
    appointment: appointment._id,
    patient: req.patient._id,
    amount: appointment.feeAmount,
    razorpayOrderId: order.id
  });
  appointment.payment = payment._id;
  await appointment.save();
  sendSuccess(res, { order, payment, keyId: process.env.RAZORPAY_KEY_ID }, 'Razorpay order created');
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const { appointmentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const appointment = await Appointment.findOne({ _id: appointmentId, patient: req.patient._id }).populate('patient');
  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }
  const valid = verifyRazorpaySignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature });
  if (!valid) {
    const error = new Error('Invalid payment signature');
    error.statusCode = 400;
    throw error;
  }
  const payment = await Payment.findOneAndUpdate(
    { appointment: appointment._id, razorpayOrderId },
    { razorpayPaymentId, razorpaySignature, status: 'paid', paidAt: new Date() },
    { new: true }
  );
  appointment.status = 'confirmed';
  appointment.payment = payment._id;
  await appointment.save();

  // Emit real-time event to admin
  emit('admin', 'appointment:updated', {
    _id: appointment._id,
    status: 'confirmed',
    patientSnapshot: appointment.patientSnapshot,
    tokenNumber: appointment.tokenNumber,
    feeAmount: appointment.feeAmount,
  });

  sendWhatsAppText({
    patient: appointment.patient,
    appointment,
    type: 'payment_confirmation',
    text: `Payment received. Your consultation is confirmed for ${appointment.appointmentDate.toDateString()} ${appointment.slotStart}.`
  }).catch(() => {});
  sendSuccess(res, { appointment, payment }, 'Payment verified and appointment confirmed');
});
