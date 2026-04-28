import { body, param } from 'express-validator';
import { Appointment } from '../models/Appointment.js';
import { CallLog } from '../models/CallLog.js';
import { generateRtcToken, makeChannelName } from '../services/agoraService.js';
import { sendCallNotification } from '../services/fcmService.js';
import { queryCloudRecording, startCloudRecording, stopCloudRecording } from '../services/recordingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { emit } from '../config/socket.js';

export const tokenValidation = [param('appointmentId').isMongoId()];
export const startCallValidation = [body('appointmentId').isMongoId()];
export const endCallValidation = [body('appointmentId').isMongoId()];

export const getPatientRtcToken = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findOne({ _id: req.params.appointmentId, patient: req.patient._id });
  if (!appointment || appointment.status !== 'calling') {
    const error = new Error('Call is not active for this appointment');
    error.statusCode = 403;
    throw error;
  }
  sendSuccess(res, generateRtcToken({ channelName: makeChannelName(appointment._id), uid: 2 }));
});

export const getAdminRtcToken = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.appointmentId);
  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }
  sendSuccess(res, generateRtcToken({ channelName: makeChannelName(appointment._id), uid: 1 }));
});

export const startCall = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.body.appointmentId);
  if (!appointment || !['confirmed', 'waiting', 'calling'].includes(appointment.status)) {
    const error = new Error('Only confirmed or waiting appointments can be called');
    error.statusCode = 400;
    throw error;
  }

  const channelName = makeChannelName(appointment._id);
  const rtc = generateRtcToken({ channelName, uid: 1 });

  let callLog = await CallLog.findOne({ appointment: appointment._id });
  if (!callLog) {
    let recordingData = {};
    try {
      const recording = await startCloudRecording({ channelName, uid: 999999, token: rtc.token });
      recordingData = {
        resourceId: recording.resourceId,
        sid: recording.sid,
        recordingMetadata: recording.raw
      };
      console.log('[Call] Recording started. resourceId:', recording.resourceId, 'sid:', recording.sid);
    } catch (recordingErr) {
      console.error('[Call] Cloud recording failed (call will proceed without recording):', recordingErr?.response?.data || recordingErr?.message);
    }
    callLog = await CallLog.create({
      appointment: appointment._id,
      channelName,
      startedAt: new Date(),
      ...recordingData
    });
  }

  appointment.status = 'calling';
  appointment.callLog = callLog._id;
  await appointment.save();

  // Emit real-time event to admin and patient
  const patientId = appointment.patient.toString();
  emit('admin', 'appointment:updated', { _id: appointment._id, status: 'calling', patientSnapshot: appointment.patientSnapshot, tokenNumber: appointment.tokenNumber });
  emit(patientId, 'appointment:calling', { appointmentId: appointment._id });

  // Send FCM push notification to patient (works even if app is closed)
  try {
    const populated = await Appointment.findById(appointment._id).populate('patient', 'fcmToken');
    const fcmToken = populated?.patient?.fcmToken;
    if (fcmToken) {
      await sendCallNotification({ fcmToken, appointmentId: appointment._id });
    } else {
      console.log('[Call] No FCM token for patient — skipping push notification');
    }
  } catch (fcmErr) {
    console.error('[Call] FCM notification failed (non-blocking):', fcmErr.message);
  }

  sendSuccess(res, { appointment, callLog, rtc }, 'Call started');
});

export const endCall = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.body.appointmentId);
  const callLog = await CallLog.findOne({ appointment: req.body.appointmentId });
  if (!appointment || !callLog) {
    const error = new Error('Active call not found');
    error.statusCode = 404;
    throw error;
  }

  let stopResult = null;
  if (callLog.resourceId && callLog.sid && callLog.status !== 'ended') {
    try {
      stopResult = await stopCloudRecording({
        channelName: callLog.channelName,
        uid: 999999,
        resourceId: callLog.resourceId,
        sid: callLog.sid
      });
    } catch (recordingErr) {
      console.error('[Call] Stop recording failed:', recordingErr?.response?.data || recordingErr?.message);
    }
  } else {
    console.log('[Call] Skipping stop recording — resourceId:', callLog.resourceId, 'sid:', callLog.sid, 'status:', callLog.status);
  }

  callLog.status = 'ended';
  callLog.endedAt = new Date();
  if (stopResult?.recordingUrl) {
    callLog.recordingUrl = stopResult.recordingUrl;
  }
  // Always save resourceId+sid so we can query later if URL is null
  if (stopResult?.resourceId) callLog.resourceId = stopResult.resourceId;
  if (stopResult?.sid) callLog.sid = stopResult.sid;
  callLog.recordingMetadata = { ...(callLog.recordingMetadata || {}), stopResult: stopResult?.raw };
  await callLog.save();

  appointment.status = 'completed';
  await appointment.save();

  // Emit real-time event to admin and patient
  const patientId = appointment.patient.toString();
  emit('admin', 'appointment:updated', { _id: appointment._id, status: 'completed', patientSnapshot: appointment.patientSnapshot, tokenNumber: appointment.tokenNumber });
  emit(patientId, 'appointment:updated', { appointmentId: appointment._id, status: 'completed' });

  sendSuccess(res, {
    appointment,
    callLog,
    recordingPending: !callLog.recordingUrl && !!callLog.resourceId
  }, 'Call ended');
});

// Query recording URL after stop — Agora uploads files to S3 async (takes 1-3 min after stop)
export const fetchRecordingUrl = asyncHandler(async (req, res) => {
  const callLog = await CallLog.findOne({ appointment: req.params.appointmentId });
  if (!callLog) {
    const error = new Error('Call log not found');
    error.statusCode = 404;
    throw error;
  }

  // Already have URL
  if (callLog.recordingUrl) {
    return sendSuccess(res, { recordingUrl: callLog.recordingUrl, status: 'ready' });
  }

  // No recording was started
  if (!callLog.resourceId || !callLog.sid) {
    return sendSuccess(res, { recordingUrl: null, status: 'no_recording' });
  }

  // Query Agora for file list
  try {
    const result = await queryCloudRecording({
      channelName: callLog.channelName,
      uid: 999999,
      resourceId: callLog.resourceId,
      sid: callLog.sid
    });

    if (result.recordingUrl) {
      callLog.recordingUrl = result.recordingUrl;
      await callLog.save();
      return sendSuccess(res, { recordingUrl: result.recordingUrl, status: 'ready' });
    }

    return sendSuccess(res, { recordingUrl: null, status: 'uploading', message: 'Recording is still uploading to S3. Try again in 1-2 minutes.' });
  } catch (err) {
    console.error('[Recording] Query failed:', err?.response?.data || err?.message);
    return sendSuccess(res, { recordingUrl: null, status: 'error', message: err?.message });
  }
});
