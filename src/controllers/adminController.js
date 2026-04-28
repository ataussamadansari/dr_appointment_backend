import { body, param } from 'express-validator';
import { Appointment } from '../models/Appointment.js';
import { Availability } from '../models/Availability.js';
import { CallLog } from '../models/CallLog.js';
import { DoctorSetting } from '../models/DoctorSetting.js';
import { Payment } from '../models/Payment.js';
import { endOfDay, nextDayDate, startOfDay, toISTDateString } from '../utils/dateHelper.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { emit } from '../config/socket.js';

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

// GET /admin/next-day-slots — same as patient endpoint but admin-accessible
export const getNextDaySlots = asyncHandler(async (req, res) => {
  const date = nextDayDate();
  const setting = await DoctorSetting.findOne().sort({ createdAt: 1 }) || await DoctorSetting.create({});

  let availability = await Availability.findOneAndUpdate(
    { date },
    { $setOnInsert: { bookedSeats: 0 }, $set: { isAvailable: setting.isAvailable, maxSeats: setting.maxSeatsPerDay } },
    { new: true, upsert: true }
  );

  const booked = await Appointment.find(
    { appointmentDate: availability.date, status: { $nin: ['cancelled', 'missed', 'payment_pending'] } },
    { tokenNumber: 1 }
  );
  const bookedSet = new Set(booked.map((a) => a.tokenNumber));

  const tokens = [];
  for (let i = 1; i <= availability.maxSeats; i++) {
    tokens.push({ tokenNumber: i, available: !bookedSet.has(i), booked: bookedSet.has(i) });
  }

  sendSuccess(res, {
    date: toISTDateString(availability.date),
    isAvailable: availability.isAvailable,
    maxSeats: availability.maxSeats,
    bookedSeats: availability.bookedSeats,
    seatsRemaining: Math.max(availability.maxSeats - availability.bookedSeats, 0),
    tokens,
  });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await DoctorSetting.findOneAndUpdate({}, req.body, { new: true, upsert: true, runValidators: true });
  sendSuccess(res, settings, 'Doctor settings updated');
});

export const listAppointments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  // Single date (legacy)
  if (req.query.date) {
    const day = startOfDay(req.query.date);
    filter.appointmentDate = { $gte: day, $lte: endOfDay(day) };
  }

  // Date range: dateFrom and/or dateTo
  if (req.query.dateFrom || req.query.dateTo) {
    filter.appointmentDate = {};
    if (req.query.dateFrom) filter.appointmentDate.$gte = startOfDay(req.query.dateFrom);
    if (req.query.dateTo)   filter.appointmentDate.$lte = endOfDay(req.query.dateTo);
  }

  console.log('[listAppointments] query:', req.query, '| filter:', JSON.stringify(filter));

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
  // Emit real-time to admin and patient
  emit('admin', 'appointment:updated', { _id: appointment._id, status: appointment.status, patientSnapshot: appointment.patientSnapshot, tokenNumber: appointment.tokenNumber });
  emit(appointment.patient.toString(), 'appointment:updated', { appointmentId: appointment._id, status: appointment.status });
  sendSuccess(res, appointment, 'Appointment status updated');
});

export const listRecordings = asyncHandler(async (req, res) => {
  const recordings = await CallLog.find().populate({
    path: 'appointment',
    populate: { path: 'patient', select: 'mobile name' }
  }).sort({ createdAt: -1 });
  sendSuccess(res, recordings);
});
