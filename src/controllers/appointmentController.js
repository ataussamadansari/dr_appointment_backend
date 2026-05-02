import mongoose from 'mongoose';
import { body } from 'express-validator';
import { Appointment } from '../models/Appointment.js';
import { Availability } from '../models/Availability.js';
import { DoctorSetting } from '../models/DoctorSetting.js';
import { Symptom } from '../models/Symptom.js';
import { isHoliday, isNextDay, nextDayDate, startOfDay, toISTDateString } from '../utils/dateHelper.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { emit } from '../config/socket.js';
import { resolveStoredFileUrl, saveBuffer } from '../services/storageService.js';

const getSettings = async () => {
  const existing = await DoctorSetting.findOne().sort({ createdAt: 1 });
  return existing || DoctorSetting.create({});
};

const ensureAvailability = async () => {
  const date = nextDayDate();
  const setting = await getSettings();
  const closedForHoliday = isHoliday(date, setting.holidayDates || []);
  // Always sync maxSeats and isAvailable from latest DoctorSetting
  const availability = await Availability.findOneAndUpdate(
    { date },
    {
      $setOnInsert: { bookedSeats: 0 },
      $set: {
        isAvailable: setting.isAvailable && !closedForHoliday,
        maxSeats: setting.maxSeatsPerDay,
      }
    },
    { new: true, upsert: true }
  );
  return { setting, availability, closedForHoliday };
};

const buildNextDaySlotPayload = async () => {
  const { setting, availability, closedForHoliday } = await ensureAvailability();

  const booked = await Appointment.find(
    { appointmentDate: availability.date, status: { $nin: ['cancelled', 'missed', 'payment_pending'] } },
    { tokenNumber: 1 }
  );
  const bookedTokens = new Set(booked.map((a) => a.tokenNumber));

  const tokens = [];
  for (let i = 1; i <= availability.maxSeats; i++) {
    tokens.push({
      tokenNumber: i,
      available: availability.isAvailable && !bookedTokens.has(i)
    });
  }

  return {
    date: toISTDateString(availability.date),
    consultationFee: setting.prescriptionAmount || setting.consultationFee,
    prescriptionAmount: setting.prescriptionAmount || setting.consultationFee,
    isHoliday: closedForHoliday,
    isAvailable: availability.isAvailable,
    maxSeats: availability.maxSeats,
    bookedSeats: availability.bookedSeats,
    seatsRemaining: Math.max(availability.maxSeats - availability.bookedSeats, 0),
    tokens
  };
};

export const createAppointmentValidation = [
  body('appointmentDate').isISO8601(),
  body('patientType').isIn(['old', 'new']),
  body('name').trim().isLength({ min: 2 }),
  body('age').isInt({ min: 0, max: 120 }),
  body('city').trim().isLength({ min: 2 }),
  body('gender').isIn(['male', 'female', 'other', 'prefer_not_to_say']),
  body('lastPrescriptionDate').isISO8601(),
  body('prescriptionPhotoBase64').optional().isString(),
  body('prescriptionPhotoUrl').optional().isString(),
  body('symptomIds').isArray({ min: 1 }),
  body('symptomIds.*').isMongoId()
];

// GET /appointments/next-day-slots
// Returns available token numbers for next day
export const getNextDaySlots = asyncHandler(async (req, res) => {
  sendSuccess(res, await buildNextDaySlotPayload());
});

export const getBookingRequirements = asyncHandler(async (req, res) => {
  const [availability, symptoms] = await Promise.all([
    buildNextDaySlotPayload(),
    Symptom.find({ isActive: true }).sort({ sortOrder: 1, name: 1 })
  ]);

  sendSuccess(res, {
    availability,
    symptoms,
    requiredFields: {
      patientType: 'old',
      lastPrescriptionDate: true,
      prescriptionPhoto: true,
      symptomIds: true
    },
    storage: {
      prescriptionPhotoMaxSizeMb: 5,
      acceptedPrescriptionPhotoTypes: ['image/jpeg', 'image/png', 'image/webp']
    }
  });
});

// POST /appointments
export const createAppointment = asyncHandler(async (req, res) => {
  if (req.body.patientType !== 'old') {
    const error = new Error('Online booking is available only for old patients');
    error.statusCode = 400;
    throw error;
  }

  const appointmentDate = startOfDay(req.body.appointmentDate);
  if (!isNextDay(appointmentDate)) {
    const error = new Error('Booking is allowed only for the next day');
    error.statusCode = 400;
    throw error;
  }

  const setting = await getSettings();
  if (isHoliday(appointmentDate, setting.holidayDates || [])) {
    const error = new Error('Booking is closed for the selected holiday');
    error.statusCode = 400;
    throw error;
  }

  const symptoms = await Symptom.find({ _id: { $in: req.body.symptomIds }, isActive: true });
  if (symptoms.length !== req.body.symptomIds.length) {
    const error = new Error('Please select valid symptoms');
    error.statusCode = 400;
    throw error;
  }

  let prescriptionPhoto;
  if (req.body.prescriptionPhotoBase64) {
    const match = String(req.body.prescriptionPhotoBase64).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      const error = new Error('Invalid prescription photo');
      error.statusCode = 400;
      throw error;
    }
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      const error = new Error('Prescription photo must be 5MB or smaller');
      error.statusCode = 400;
      throw error;
    }
    const ext = match[1].split('/')[1].replace('jpeg', 'jpg');
    prescriptionPhoto = await saveBuffer({
      key: `prescriptions/uploads/${req.patient._id}-${Date.now()}.${ext}`,
      buffer,
      contentType: match[1]
    });
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
      patientType: req.body.patientType,
      lastPrescriptionDate: startOfDay(req.body.lastPrescriptionDate),
      prescriptionPhotoUrl: prescriptionPhoto?.url || req.body.prescriptionPhotoUrl || '',
      prescriptionPhotoKey: prescriptionPhoto?.key || '',
      symptomIds: symptoms.map((symptom) => symptom._id),
      symptoms: symptoms.map((symptom) => symptom.name).join(', '),
      feeAmount: setting.prescriptionAmount || setting.consultationFee
    }], { session });
  });

  await session.endSession();

  const appointmentResponse = appointment.toObject();
  appointmentResponse.prescriptionPhotoUrl = await resolveStoredFileUrl({
    key: appointment.prescriptionPhotoKey,
    url: appointment.prescriptionPhotoUrl
  });

  // Emit real-time event to admin
  emit('admin', 'appointment:new', {
    _id: appointment._id,
    status: appointment.status,
    tokenNumber: appointment.tokenNumber,
    feeAmount: appointment.feeAmount,
    patientSnapshot: appointment.patientSnapshot,
    appointmentDate: appointment.appointmentDate,
  });

  sendSuccess(res, appointmentResponse, 'Appointment created. Complete payment to confirm.', 201);
});
