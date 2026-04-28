import { body, param } from 'express-validator';
import { Appointment } from '../models/Appointment.js';
import { CallLog } from '../models/CallLog.js';
import { generateRtcToken, makeChannelName } from '../services/agoraService.js';
import { sendCallNotification } from '../services/fcmService.js';
import {
  RECORDING_UID,
  queryCloudRecording,
  startCloudRecording,
  stopCloudRecording,
  validateRecordingConfig,
} from '../services/recordingService.js';
import { isToday } from '../utils/dateHelper.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { emit } from '../config/socket.js';

export const tokenValidation      = [param('appointmentId').isMongoId()];
export const startCallValidation  = [body('appointmentId').isMongoId()];
export const endCallValidation    = [body('appointmentId').isMongoId()];

// ── Patient token ─────────────────────────────────────────────────────────────
export const getPatientRtcToken = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findOne({
    _id: req.params.appointmentId,
    patient: req.patient._id,
  });
  if (!appointment || appointment.status !== 'calling') {
    const error = new Error('Call is not active for this appointment');
    error.statusCode = 403;
    throw error;
  }
  sendSuccess(res, generateRtcToken({ channelName: makeChannelName(appointment._id), uid: 2 }));
});

// ── Admin token (rejoin) ──────────────────────────────────────────────────────
export const getAdminRtcToken = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.appointmentId);
  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }
  sendSuccess(res, generateRtcToken({ channelName: makeChannelName(appointment._id), uid: 1 }));
});

// ── Start call ────────────────────────────────────────────────────────────────
export const startCall = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.body.appointmentId);
  if (!appointment || !['confirmed', 'waiting', 'calling'].includes(appointment.status)) {
    const error = new Error('Only confirmed or waiting appointments can be called');
    error.statusCode = 400;
    throw error;
  }
  if (!isToday(appointment.appointmentDate)) {
    const error = new Error('Video call can only be started on the day of the appointment');
    error.statusCode = 400;
    throw error;
  }

  const channelName = makeChannelName(appointment._id);
  const rtc = generateRtcToken({ channelName, uid: 1 });

  // Reuse active callLog (non-ended) — fresh start otherwise
  let callLog = await CallLog.findOne({
    appointment: appointment._id,
    status: { $ne: 'ended' },
  });

  if (!callLog) {
    // Validate recording config before attempting
    let recordingOk = false;
    try {
      validateRecordingConfig();
      recordingOk = true;
    } catch (e) {
      console.warn('[Call] Recording config invalid — call will proceed without recording:', e.message);
    }

    let recordingData = {
      recordingStatus: 'not_started',
      recordingUid: RECORDING_UID,
    };

    if (recordingOk) {
      try {
        const recording = await startCloudRecording({ channelName, token: rtc.token });
        recordingData = {
          resourceId:         recording.resourceId,
          sid:                recording.sid,
          recordingUid:       RECORDING_UID,
          recordingStatus:    'starting',
          recordingStartedAt: new Date(),
          recordingMetadata:  { startRaw: recording.raw },
        };
        console.log(`[Call] Recording started | sid: ${recording.sid} | channel: ${channelName}`);
      } catch (recordingErr) {
        const errData = recordingErr?.response?.data || { message: recordingErr?.message };
        console.error('[Call] Cloud recording failed (call proceeds without recording):', JSON.stringify(errData));
        recordingData = {
          recordingStatus: 'failed',
          recordingError:  errData,
          recordingUid:    RECORDING_UID,
        };
      }
    }

    callLog = await CallLog.create({
      appointment: appointment._id,
      channelName,
      startedAt: new Date(),
      ...recordingData,
    });

    // Schedule query after 20s to confirm recording is active
    if (recordingData.recordingStatus === 'starting') {
      const callLogId = callLog._id;
      setTimeout(async () => {
        try {
          const cl = await CallLog.findById(callLogId);
          if (!cl || cl.status === 'ended') return; // call already ended
          if (!cl.resourceId || !cl.sid) return;

          console.log(`[Recording] Scheduled query (20s) | sid: ${cl.sid}`);
          const result = await queryCloudRecording({
            channelName: cl.channelName,
            resourceId:  cl.resourceId,
            sid:         cl.sid,
          });

          cl.lastAgoraQueryResponse = result.serverResponse;
          cl.recordingStatus = 'recording';
          await cl.save();
          console.log('[Recording] Query success — status set to recording');
        } catch (qErr) {
          const errData = qErr?.response?.data || { message: qErr?.message };
          console.error('[Recording] Scheduled query failed:', JSON.stringify(errData));
          try {
            const cl = await CallLog.findById(callLogId);
            if (cl && cl.status !== 'ended') {
              cl.recordingStatus = 'failed';
              cl.recordingError  = errData;
              cl.lastAgoraQueryResponse = errData;
              await cl.save();
            }
          } catch (_) {}
        }
      }, 20_000);
    }
  } else {
    console.log('[Call] Rejoining existing active callLog:', callLog._id);
  }

  appointment.status  = 'calling';
  appointment.callLog = callLog._id;
  await appointment.save();

  // Real-time events
  const patientId = appointment.patient.toString();
  emit('admin', 'appointment:updated', {
    _id: appointment._id, status: 'calling',
    patientSnapshot: appointment.patientSnapshot, tokenNumber: appointment.tokenNumber,
  });
  emit(patientId, 'appointment:calling', { appointmentId: appointment._id });

  // FCM push
  try {
    const populated = await Appointment.findById(appointment._id).populate('patient', 'fcmToken');
    const fcmToken  = populated?.patient?.fcmToken;
    if (fcmToken) {
      await sendCallNotification({ fcmToken, appointmentId: appointment._id });
    } else {
      console.log('[Call] No FCM token — skipping push notification');
    }
  } catch (fcmErr) {
    console.error('[Call] FCM failed (non-blocking):', fcmErr.message);
  }

  sendSuccess(res, { appointment, callLog, rtc }, 'Call started');
});

// ── End call ──────────────────────────────────────────────────────────────────
export const endCall = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.body.appointmentId);
  const callLog = await CallLog.findOne({
    appointment: req.body.appointmentId,
    status: { $ne: 'ended' },
  }).sort({ createdAt: -1 });

  if (!appointment || !callLog) {
    const error = new Error('Active call not found');
    error.statusCode = 404;
    throw error;
  }

  // Mark call ended immediately
  callLog.status  = 'ended';
  callLog.endedAt = new Date();
  await callLog.save();

  appointment.status = 'completed';
  await appointment.save();

  // Real-time events
  const patientId = appointment.patient.toString();
  emit('admin', 'appointment:updated', {
    _id: appointment._id, status: 'completed',
    patientSnapshot: appointment.patientSnapshot, tokenNumber: appointment.tokenNumber,
  });
  emit(patientId, 'appointment:updated', { appointmentId: appointment._id, status: 'completed' });

  // Stop recording in background (non-blocking)
  if (callLog.resourceId && callLog.sid) {
    const callLogId = callLog._id;
    setImmediate(async () => {
      try {
        const cl = await CallLog.findById(callLogId);
        if (!cl) return;

        // If recording started recently, wait until 35s have passed before stopping
        if (cl.recordingStartedAt) {
          const elapsed = (Date.now() - new Date(cl.recordingStartedAt).getTime()) / 1000;
          const MIN_SECONDS = 35;
          if (elapsed < MIN_SECONDS) {
            const waitMs = Math.ceil((MIN_SECONDS - elapsed) * 1000);
            console.log(`[Recording] Waiting ${Math.ceil(waitMs / 1000)}s before stopping (worker init)...`);
            await new Promise((r) => setTimeout(r, waitMs));
          }
        }

        // Re-fetch callLog after wait (status may have changed)
        const clFresh = await CallLog.findById(callLogId);
        if (!clFresh) return;

        clFresh.recordingStatus = 'stopping';
        await clFresh.save();

        const result = await stopCloudRecording({
          channelName:        clFresh.channelName,
          resourceId:         clFresh.resourceId,
          sid:                clFresh.sid,
          recordingStartedAt: null, // guard already handled above
        });

        clFresh.recordingStatus   = 'completed';
        clFresh.recordingEndedAt  = new Date();
        clFresh.recordingUrl      = result.recordingUrl || null;
        clFresh.recordingFiles    = result.recordingFiles || [];
        clFresh.recordingMetadata = { ...(clFresh.recordingMetadata || {}), stopRaw: result.raw };
        await clFresh.save();

        console.log('[Recording] Background stop complete | URL:', result.recordingUrl || 'pending S3 upload');
      } catch (err) {
        const errData = err?.response?.data || { message: err?.message, code: err?.code };
        console.error('[Recording] Background stop failed:', JSON.stringify(errData));
        try {
          const cl = await CallLog.findById(callLogId);
          if (cl) {
            cl.recordingStatus = 'failed';
            cl.recordingError  = errData;
            await cl.save();
          }
        } catch (_) {}
      }
    });
  } else {
    console.log('[Call] No recording to stop — resourceId or sid missing');
  }

  sendSuccess(res, {
    appointment,
    callLog,
    recordingPending: !callLog.recordingUrl && !!callLog.resourceId,
  }, 'Call ended');
});

// ── Fetch recording URL (poll after stop) ─────────────────────────────────────
export const fetchRecordingUrl = asyncHandler(async (req, res) => {
  const callLog = await CallLog.findOne({ appointment: req.params.appointmentId })
    .sort({ createdAt: -1 });

  if (!callLog) {
    const error = new Error('Call log not found');
    error.statusCode = 404;
    throw error;
  }

  if (callLog.recordingUrl) {
    return sendSuccess(res, { recordingUrl: callLog.recordingUrl, status: 'ready' });
  }
  if (!callLog.resourceId || !callLog.sid) {
    return sendSuccess(res, { recordingUrl: null, status: 'no_recording', recordingStatus: callLog.recordingStatus });
  }
  if (callLog.recordingStatus === 'failed') {
    return sendSuccess(res, {
      recordingUrl: null,
      status: 'failed',
      recordingStatus: 'failed',
      error: callLog.recordingError,
    });
  }

  try {
    const result = await queryCloudRecording({
      channelName: callLog.channelName,
      resourceId:  callLog.resourceId,
      sid:         callLog.sid,
    });

    callLog.lastAgoraQueryResponse = result.serverResponse;

    if (result.recordingUrl) {
      callLog.recordingUrl    = result.recordingUrl;
      callLog.recordingStatus = 'completed';
      await callLog.save();
      return sendSuccess(res, { recordingUrl: result.recordingUrl, status: 'ready' });
    }

    await callLog.save();
    return sendSuccess(res, {
      recordingUrl: null,
      status: 'uploading',
      recordingStatus: callLog.recordingStatus,
      message: 'Recording is still uploading to S3. Try again in 1-2 minutes.',
    });
  } catch (err) {
    const errData = err?.response?.data || { message: err?.message };
    console.error('[Recording] Query failed:', JSON.stringify(errData));
    return sendSuccess(res, { recordingUrl: null, status: 'error', message: err?.message });
  }
});

// ── Debug endpoint (admin only) ───────────────────────────────────────────────
export const getRecordingStatus = asyncHandler(async (req, res) => {
  const callLog = await CallLog.findOne({ appointment: req.params.appointmentId })
    .sort({ createdAt: -1 });

  if (!callLog) {
    const error = new Error('Call log not found');
    error.statusCode = 404;
    throw error;
  }

  const appointmentId = req.params.appointmentId;
  const expectedPrefix = `recordings/${appointmentId}`;

  sendSuccess(res, {
    appointmentId,
    channelName:            callLog.channelName,
    resourceId:             callLog.resourceId,
    sid:                    callLog.sid,
    recordingUid:           callLog.recordingUid || RECORDING_UID,
    recordingStatus:        callLog.recordingStatus,
    callStatus:             callLog.status,
    recordingStartedAt:     callLog.recordingStartedAt,
    recordingEndedAt:       callLog.recordingEndedAt,
    recordingError:         callLog.recordingError,
    lastAgoraQueryResponse: callLog.lastAgoraQueryResponse,
    recordingUrl:           callLog.recordingUrl,
    recordingFiles:         callLog.recordingFiles,
    expectedS3Prefix:       expectedPrefix,
    expectedS3Bucket:       process.env.AGORA_RECORDING_BUCKET,
  });
});
