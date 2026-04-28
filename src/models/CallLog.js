import mongoose from 'mongoose';

const callLogSchema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  channelName: { type: String, required: true },
  doctorUid:   { type: Number, default: 1 },
  patientUid:  { type: Number, default: 2 },
  recordingUid: { type: Number, default: 999999 },
  resourceId:  String,
  sid:         String,

  // Recording lifecycle status
  recordingStatus: {
    type: String,
    enum: ['not_started', 'starting', 'recording', 'stopping', 'completed', 'failed'],
    default: 'not_started'
  },
  recordingError:        mongoose.Schema.Types.Mixed,  // full error object on failure
  lastAgoraQueryResponse: mongoose.Schema.Types.Mixed, // last query API response
  recordingStartedAt:    Date,
  recordingEndedAt:      Date,
  recordingFiles:        [String], // S3 file paths/URLs

  // Call lifecycle
  status:    { type: String, enum: ['started', 'ended', 'failed'], default: 'started' },
  startedAt: Date,
  endedAt:   Date,

  // Legacy / compat
  recordingUrl:      String,
  recordingMetadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

callLogSchema.index({ appointment: 1, status: 1 });

export const CallLog = mongoose.model('CallLog', callLogSchema);
