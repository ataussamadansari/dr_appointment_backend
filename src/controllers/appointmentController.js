import mongoose from 'mongoose';
import { body } from 'express-validator';
import { Appointment } from '../models/Appointment.js';
import { Availability } from '../models/Availability.js';
import { DoctorSetting } from '../models/DoctorSetting.js';
import { isNextDay, nextDayDate, startOfDay, toISTDateString } from '../utils/dateHelper.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { emit } from '../config/socket.js';

const getSettings = async () => {
  const existing = await DoctorSetting.findOne().sort({ createdAt: 1 });
  return existing || DoctorSetting.create({});
};

const ensureAvailability = async () => {
  const date = nextDayDate();
  const setting = await getSettings();
  // Always sync maxSeats and isAvailable from latest DoctorSetting
  const availability = await Availability.findOneAndUpdate(
    { date },
    {
      $setOnInsert: { bookedSeats: 0 },
      $set: {
        isAvailable: setting.isAvailable,
        maxSeats: setting.maxSeatsPerDay,
      }
    },
    { new: true, upsert: true }
  );
  return { setting, availability };
};

export const createAppointmentValidation = [
  body('appointmentDate').isISO8601(),
  body('name').trim().isLength({ min: 2 }),
  body('age').isInt({ min: 0, max: 120 }),
  body('city').trim().isLength({ min: 2 }),
  body('gender').isIn(['male', 'female', 'other', 'prefer_not_to_say']),
  body('symptoms').trim().isLength({ min: 3 })
];

// GET /appointments/next-day-slots
// Returns available token numbers for next day
export const getNextDaySlots = asyncHandler(async (req, res) => {
  const { setting, availability } = await ensureAvailability();

  // Get already booked token numbers for next day
  const booked = await Appointment.find(
    { appointmentDate: availability.date, status: { $nin: ['cancelled', 'missed', 'payment_pending'] } },
    { tokenNumber: 1 }
  );
  const bookedTokens = new Set(booked.map((a) => a.tokenNumber));

  // Build token list 1..maxSeats
  const tokens = [];
  for (let i = 1; i <= availability.maxSeats; i++) {
    tokens.push({
      tokenNumber: i,
      available: availability.isAvailable && !bookedTokens.has(i)
    });
  }

  const seatsRemaining = Math.max(availability.maxSeats - availability.bookedSeats, 0);

  sendSuccess(res, {
    date: toISTDateString(availability.date),
    consultationFee: setting.consultationFee,
    isAvailable: availability.isAvailable,
    maxSeats: availability.maxSeats,
    bookedSeats: availability.bookedSeats,
    seatsRemaining,
    tokens
  });
});

// POST /appointments
export const createAppointment = asyncHandler(async (req, res) => {
  const appointmentDate = startOfDay(req.body.appointmentDate);
  if (!isNextDay(appointmentDate)) {
    const error = new Error('Booking is allowed only for the next day');
    error.statusCode = 400;
    throw error;
  }

  const session = await mongoose.startSession();
  let appointment;

  await session.withTransaction(async () => {
    const { setting } = await ensureAvailability();

    // Atomically increment bookedSeats only if seats available
    const availability = await Availability.findOneAndUpdate(
      { date: appointmentDate, isAvailable: true, $expr: { $lt: ['$bookedSeats', '$maxSeats'] } },
      { $inc: { bookedSeats: 1 } },
      { new: true, session }
    );
    if (!availability) {
      const error = new Error('No tokens available for next day');
      error.statusCode = 409;
      throw error;
    }

    // Assign next available token number (lowest unbooked)
    const bookedTokens = await Appointment.find(
      { appointmentDate, status: { $nin: ['cancelled', 'missed', 'payment_pending'] } },
      { tokenNumber: 1 },
      { session }
    );
    const bookedSet = new Set(bookedTokens.map((a) => a.tokenNumber));
    let tokenNumber = null;
    for (let i = 1; i <= availability.maxSeats; i++) {
      if (!bookedSet.has(i)) { tokenNumber = i; break; }
    }
    if (!tokenNumber) {
      const error = new Error('No tokens available for next day');
      error.statusCode = 409;
      throw error;
    }

    [appointment] = await Appointment.create([{
      patient: req.patient._id,
      appointmentDate,
      tokenNumber,
      patientSnapshot: {
        name: req.body.name,
        age: req.body.age,
        city: req.body.city,
        gender: req.body.gender,
        mobile: req.patient.mobile
      },
      symptoms: req.body.symptoms,
      feeAmount: setting.consultationFee
    }], { session });
  });

  await session.endSession();

  // Emit real-time event to admin
  emit('admin', 'appointment:new', {
    _id: appointment._id,
    status: appointment.status,
    tokenNumber: appointment.tokenNumber,
    feeAmount: appointment.feeAmount,
    patientSnapshot: appointment.patientSnapshot,
    appointmentDate: appointment.appointmentDate,
  });

  sendSuccess(res, appointment, 'Appointment created. Complete payment to confirm.', 201);
});