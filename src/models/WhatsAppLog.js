import mongoose from 'mongoose';

const whatsappLogSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
  to: { type: String, required: true },
  type: { type: String, enum: ['booking_confirmation', 'payment_confirmation', 'prescription_document'], required: true },
  payload: mongoose.Schema.Types.Mixed,
  response: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['sent', 'failed', 'skipped'], default: 'sent' },
  error: String
}, { timestamps: true });

export const WhatsAppLog = mongoose.model('WhatsAppLog', whatsappLogSchema);
