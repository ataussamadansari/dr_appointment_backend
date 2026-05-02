import mongoose from 'mongoose';
import { emit } from '../config/socket.js';
import { env } from '../config/env.js';
import { Appointment } from '../models/Appointment.js';
import { Availability } from '../models/Availability.js';
import { DoctorSetting } from '../models/DoctorSetting.js';
import { Patient } from '../models/Patient.js';
import { WhatsappBookingSession } from '../models/WhatsappBookingSession.js';
import { nextDayDate, toISTDateString } from '../utils/dateHelper.js';
import { createPaymentLinkForWhatsappBooking } from './cashfreePaymentLinkService.js';
import { normalizeWhatsappPhone, sendTextMessage } from './interaktService.js';

const TRIGGERS = new Set(['hi', 'hello', 'hey', 'book', 'appointment', 'offline appointment']);

const appendInbound = (session, text, rawPayload) => {
  session.rawMessages.push({ direction: 'inbound', text, payload: rawPayload });
  session.lastInboundMessageAt = new Date();
};

const sendAndTrack = async (session, message) => {
  const response = await sendTextMessage(session.phone, message);
  session.rawMessages.push({ direction: 'outbound', text: message, payload: response });
  session.lastOutboundMessageAt = new Date();
  await session.save();
  return response;
};

const resetSession = (session, { customerNameFromWhatsapp, rawPayload, text } = {}) => {
  session.customerNameFromWhatsapp = customerNameFromWhatsapp || session.customerNameFromWhatsapp;
  session.step = 'ASK_NAME';
  session.patientName = undefined;
  session.age = undefined;
  session.city = undefined;
  session.appointmentDate = nextDayDate();
  session.amount = undefined;
  session.cashfreeLinkId = undefined;
  session.cashfreeLinkUrl = undefined;
  session.cashfreeOrderId = undefined;
  session.cashfreeLinkRaw = undefined;
  session.paymentStatus = 'pending';
  session.tokenNumber = undefined;
  session.tokenLabel = undefined;
  session.appointmentId = undefined;
  if (text) appendInbound(session, text, rawPayload);
};

const getSetting = async () => (
  await DoctorSetting.findOne().sort({ createdAt: 1 }) || await DoctorSetting.create({})
);

const startBooking = async ({ phone, text, rawPayload, customerName }) => {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  let session = await WhatsappBookingSession.findOne({ phone: normalizedPhone }).sort({ createdAt: -1 });
  if (!session) session = new WhatsappBookingSession({ phone: normalizedPhone });
  resetSession(session, { customerNameFromWhatsapp: customerName, rawPayload, text });
  await session.save();
  await sendAndTrack(session, 'Namaste 🙏 Doctor appointment booking ke liye patient ka name bhejein.');
  return session;
};

export const handleIncomingWhatsappMessage = async ({ phone, text, rawPayload, customerName }) => {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const incomingText = String(text || '').trim();
  const normalizedText = incomingText.toLowerCase();

  if (!normalizedPhone || !incomingText) return null;
  if (TRIGGERS.has(normalizedText)) {
    return startBooking({ phone: normalizedPhone, text: incomingText, rawPayload, customerName });
  }

  let session = await WhatsappBookingSession.findOne({ phone: normalizedPhone }).sort({ createdAt: -1 });
  if (!session || ['CANCELLED', 'EXPIRED'].includes(session.step)) {
    return startBooking({ phone: normalizedPhone, text: incomingText, rawPayload, customerName });
  }

  appendInbound(session, incomingText, rawPayload);

  if (normalizedText === 'cancel') {
    session.step = 'CANCELLED';
    await session.save();
    await sendAndTrack(session, 'Booking cancelled. To start again, send Hi.');
    return session;
  }

  if (normalizedText === 'restart') {
    resetSession(session, { customerNameFromWhatsapp: customerName });
    await session.save();
    await sendAndTrack(session, 'Namaste 🙏 Doctor appointment booking ke liye patient ka name bhejein.');
    return session;
  }

  if (session.step === 'ASK_NAME') {
    if (incomingText.length < 2) {
      await session.save();
      await sendAndTrack(session, 'Kripya patient ka valid name bhejein.');
      return session;
    }
    session.patientName = incomingText;
    session.step = 'ASK_AGE';
    await session.save();
    await sendAndTrack(session, 'Patient age bhejein.');
    return session;
  }

  if (session.step === 'ASK_AGE') {
    const age = Number(incomingText);
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      await session.save();
      await sendAndTrack(session, 'Kripya age number me bhejein. Age 1 se 120 ke beech honi chahiye.');
      return session;
    }
    session.age = age;
    session.step = 'ASK_CITY';
    await session.save();
    await sendAndTrack(session, 'Patient city bhejein.');
    return session;
  }

  if (session.step === 'ASK_CITY') {
    if (incomingText.length < 2) {
      await session.save();
      await sendAndTrack(session, 'Kripya valid city name bhejein.');
      return session;
    }

    const setting = await getSetting();
    const maxSeats = Math.min(setting.maxSeatsPerDay || 20, env.cashfree.maxDailyTokens || 20);
    const appointmentDate = nextDayDate();
    const paidCount = await Appointment.countDocuments({
      appointmentDate,
      status: { $nin: ['cancelled', 'missed', 'payment_pending'] }
    });
    if (!setting.isAvailable || paidCount >= maxSeats) {
      session.city = incomingText;
      session.appointmentDate = appointmentDate;
      session.step = 'EXPIRED';
      await session.save();
      await sendAndTrack(session, 'Kal ke liye saare token full ho chuke hain. Booking ke liye baad me dobara try karein.');
      return session;
    }

    session.city = incomingText;
    session.appointmentDate = appointmentDate;
    session.amount = setting.consultationFee || env.cashfree.consultationFee;
    let link;
    try {
      link = await createPaymentLinkForWhatsappBooking(session);
    } catch (error) {
      session.rawMessages.push({ direction: 'outbound', text: 'cashfree_link_error', payload: { error: error.response?.data || error.message } });
      await session.save();
      await sendAndTrack(session, 'Payment link banane me abhi problem aa rahi hai. Kripya thodi der baad restart bhejkar dobara try karein.');
      return session;
    }
    session.cashfreeLinkId = link.linkId;
    session.cashfreeLinkUrl = link.linkUrl;
    session.cashfreeLinkRaw = link.raw;
    session.step = 'PAYMENT_PENDING';
    session.paymentStatus = 'pending';
    await session.save();
    await sendAndTrack(session, `Payment complete karne ke liye link par click karein:\n${session.cashfreeLinkUrl}\nPayment ke baad token automatically confirm ho jayega.`);
    return session;
  }

  if (session.step === 'PAYMENT_PENDING') {
    await session.save();
    await sendAndTrack(session, `Aapki payment abhi pending hai. Link yahan hai:\n${session.cashfreeLinkUrl}\nPayment ke baad token automatically confirm ho jayega.`);
    return session;
  }

  if (session.step === 'CONFIRMED') {
    await session.save();
    await sendAndTrack(session, `Aapki appointment confirmed hai.\nToken No: ${session.tokenLabel}\nDate: ${toISTDateString(session.appointmentDate)}`);
    return session;
  }

  await session.save();
  await sendAndTrack(session, 'Booking start karne ke liye Hi bhejein.');
  return session;
};

export const confirmWhatsappBookingPayment = async ({ linkId, orderId, rawPayload }) => {
  if (!linkId) return { status: 'ignored', reason: 'missing_link_id' };

  const session = await WhatsappBookingSession.findOne({ cashfreeLinkId: linkId });
  if (!session) return { status: 'ignored', reason: 'session_not_found' };
  if (session.step === 'CONFIRMED' && session.appointmentId) {
    return { status: 'already_confirmed', session };
  }

  const dbSession = await mongoose.startSession();
  let appointment;
  let overflow = false;

  try {
    await dbSession.withTransaction(async () => {
      const lockedSession = await WhatsappBookingSession.findOne({
        _id: session._id,
        step: { $ne: 'CONFIRMED' }
      }).session(dbSession);
      if (!lockedSession) return;

      const setting = await getSetting();
      const appointmentDate = lockedSession.appointmentDate || nextDayDate();
      const maxSeats = Math.min(setting.maxSeatsPerDay || 20, env.cashfree.maxDailyTokens || 20);

      let availability = await Availability.findOneAndUpdate(
        { date: appointmentDate },
        {
          $setOnInsert: { bookedSeats: 0 },
          $set: { isAvailable: setting.isAvailable, maxSeats }
        },
        { new: true, upsert: true, session: dbSession }
      );

      availability = await Availability.findOneAndUpdate(
        { date: appointmentDate, isAvailable: true, $expr: { $lt: ['$bookedSeats', '$maxSeats'] } },
        { $inc: { bookedSeats: 1 } },
        { new: true, session: dbSession }
      );

      if (!availability) {
        lockedSession.step = 'CANCELLED';
        lockedSession.paymentStatus = 'paid';
        lockedSession.cashfreeOrderId = orderId || lockedSession.cashfreeOrderId;
        lockedSession.tokenLabel = 'FULL_REFUND_MANUAL';
        lockedSession.rawMessages.push({ direction: 'inbound', text: 'cashfree_paid_full', payload: rawPayload });
        await lockedSession.save({ session: dbSession });
        overflow = true;
        return;
      }

      const tokenNumber = availability.bookedSeats;
      const tokenLabel = `T${tokenNumber}`;
      const patient = await Patient.findOneAndUpdate(
        { mobile: lockedSession.phone },
        {
          $set: {
            name: lockedSession.patientName,
            age: lockedSession.age,
            city: lockedSession.city
          }
        },
        { new: true, upsert: true, session: dbSession, setDefaultsOnInsert: true }
      );

      [appointment] = await Appointment.create([{
        patient: patient._id,
        source: 'whatsapp',
        patientName: lockedSession.patientName,
        age: lockedSession.age,
        city: lockedSession.city,
        phone: lockedSession.phone,
        appointmentDate,
        tokenNumber,
        tokenLabel,
        patientSnapshot: {
          name: lockedSession.patientName,
          age: lockedSession.age,
          city: lockedSession.city,
          mobile: lockedSession.phone
        },
        symptoms: 'Offline WhatsApp booking',
        status: 'confirmed',
        feeAmount: lockedSession.amount || setting.consultationFee || env.cashfree.consultationFee,
        amount: lockedSession.amount || setting.consultationFee || env.cashfree.consultationFee,
        paymentStatus: 'paid',
        cashfreeLinkId: lockedSession.cashfreeLinkId,
        cashfreePaymentRaw: rawPayload
      }], { session: dbSession });

      lockedSession.step = 'CONFIRMED';
      lockedSession.paymentStatus = 'paid';
      lockedSession.cashfreeOrderId = orderId || lockedSession.cashfreeOrderId;
      lockedSession.tokenNumber = tokenNumber;
      lockedSession.tokenLabel = tokenLabel;
      lockedSession.appointmentDate = appointmentDate;
      lockedSession.appointmentId = appointment._id;
      lockedSession.rawMessages.push({ direction: 'inbound', text: 'cashfree_paid', payload: rawPayload });
      await lockedSession.save({ session: dbSession });
    });
  } finally {
    await dbSession.endSession();
  }

  const refreshed = await WhatsappBookingSession.findById(session._id);
  if (overflow) {
    await sendAndTrack(refreshed, 'Payment receive ho gaya hai, lekin kal ke tokens full ho chuke hain. Clinic team refund/manual booking ke liye contact karegi.');
    return { status: 'full', session: refreshed };
  }

  if (appointment) {
    emit('admin', 'appointment:new', {
      _id: appointment._id,
      status: appointment.status,
      tokenNumber: appointment.tokenNumber,
      feeAmount: appointment.feeAmount,
      patientSnapshot: appointment.patientSnapshot,
      appointmentDate: appointment.appointmentDate,
      source: appointment.source
    });
  }

  if (refreshed?.step === 'CONFIRMED') {
    await sendAndTrack(refreshed, `✅ Appointment Confirmed\nName: ${refreshed.patientName}\nToken No: ${refreshed.tokenLabel}\nDate: ${toISTDateString(refreshed.appointmentDate)}\nCity: ${refreshed.city}\nPayment: Paid`);
  }

  return { status: 'confirmed', session: refreshed, appointment };
};
