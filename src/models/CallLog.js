import mongoose from 'mongoose';

const callLogSchema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  channelName: { type: String, required: true },
  doctorUid: { type: Number, default: 1 },
  patientUid: { type: Number, default: 2 },
  resourceId: String,
  sid: String,
  status: { type: String, enum: ['started', 'ended', 'failed'], default: 'started' },
  startedAt: Date,
  endedAt: Date,
  recordingUrl: String,
  recordingMetadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// Index for fast lookup — not unique so doctor can restart a call
callLogSchema.index({ appointment: 1, status: 1 });

export const CallLog = mongoose.model('CallLog', callLogSchema);
