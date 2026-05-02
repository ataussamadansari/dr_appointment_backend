import mongoose from 'mongoose';

const whatsappMessageLogSchema = new mongoose.Schema({
  phone: { type: String, index: true },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  provider: { type: String, enum: ['interakt', 'cashfree'], default: 'interakt' },
  eventType: String,
  messageText: String,
  payload: mongoose.Schema.Types.Mixed,
  response: mongoose.Schema.Types.Mixed,
  status: { type: String, index: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const WhatsappMessageLog = mongoose.model('WhatsappMessageLog', whatsappMessageLogSchema);
