import { body, param } from 'express-validator';
import { Appointment } from '../models/Appointment.js';
import { CallLog } from '../models/CallLog.js';
import { DoctorSetting } from '../models/DoctorSetting.js';
import { Payment } from '../models/Payment.js';
import { endOfDay, nextDayDate, startOfDay } from '../utils/dateHelper.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const settingValidation = [
  body('consultationFee').isFloat({ min: 1 }),
  body('maxSeatsPerDay').isInt({ min: 1 }),
  body('isAvailable').isBoolean()
];
export const statusValidation = [param('id').isMongoId(), body('status').isIn(['payment_pending', 'confirmed', 'waiting', 'calling', 'completed', 'cancelled', 'missed'])];

export const dashboardStats = asyncHandler(async (req, res) => {
  const today = startOfDay(new Date());
  const tomorrow = nextDayDate();
  const [todayAppointments, tomorrowAppointments, completedAppointments, paid] = await Promise.all([
    Appointment.countDocuments({ appointmentDate: today }),
    Appointment.countDocuments({ appointmentDate: tomorrow }),
    Appointment.countDocuments({ status: 'completed' }),
    Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, revenue: { $sum: '$amount' }, count: { $sum: 1 } } }])
  ]);
  sendSuccess(res, {
    todayAppointments,
    tomorrowAppointments,
    completedAppointments,
    revenue: paid[0]?.revenue || 0,
    paidCount: paid[0]?.count || 0
  });
});

export const getSettings = asyncHandler(async (req, res) => {
  const existing = await DoctorSetting.findOne().sort({ createdAt: 1 });
  const settings = existing || await DoctorSetting.create({});
  sendSuccess(res, settings);
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await DoctorSetting.findOneAndUpdate({}, req.body, { new: true, upsert: true, runValidators: true });
  sendSuccess(res, settings, 'Doctor settings updated');
});

export const listAppointments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.date) {
    const day = startOfDay(req.query.date);
    filter.appointmentDate = { $gte: day, $lte: endOfDay(day) };
  }
  const appointments = await Appointment.find(filter)
    .populate('patient', 'mobile name')
    .populate('payment')
    .populate('prescription')
    .sort({ appointmentDate: -1, tokenNumber: 1 });
  sendSuccess(res, appointments);
});

export const appointmentDetail = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patient')
    .populate('payment')
    .populate('prescription')
    .populate('callLog');
  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }
  sendSuccess(res, appointment);
});

export const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }
  sendSuccess(res, appointment, 'Appointment status updated');
});

export const listRecordings = asyncHandler(async (req, res) => {
  const recordings = await CallLog.find().populate({
    path: 'appointment',
    populate: { path: 'patient', select: 'mobile name' }
  }).sort({ createdAt: -1 });
  sendSuccess(res, recordings);
});
