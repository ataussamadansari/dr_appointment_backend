import mongoose from 'mongoose';

const rawMessageSchema = new mongoose.Schema({
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  text: String,
  payload: mongoose.Schema.Types.Mixed,
  at: { type: Date, default: Date.now }
}, { _id: false });

const whatsappBookingSessionSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  customerNameFromWhatsapp: String,
  step: {
    type: String,
    enum: ['ASK_NAME', 'ASK_AGE', 'ASK_CITY', 'PAYMENT_PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'],
    required: true,
    default: 'ASK_NAME',
    index: true
  },
  patientName: { type: String, trim: true },
  age: { type: Number, min: 1, max: 120 },
  city: { type: String, trim: true },
  appointmentDate: { type: Date, index: true },
  amount: Number,
  cashfreeLinkId: { type: String, index: true },
  cashfreeLinkUrl: String,
  cashfreeOrderId: String,
  cashfreeLinkRaw: mongoose.Schema.Types.Mixed,
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'expired'],
    default: 'pending',
    index: true
  },
  tokenNumber: Number,
  tokenLabel: String,
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  rawMessages: [rawMessageSchema],
  lastInboundMessageAt: Date,
  lastOutboundMessageAt: Date
}, { timestamps: true });

whatsappBookingSessionSchema.index({ phone: 1, createdAt: -1 });
whatsappBookingSessionSchema.index({ appointmentDate: 1, tokenNumber: 1 }, { sparse: true });

export const WhatsappBookingSession = mongoose.model('WhatsappBookingSession', whatsappBookingSessionSchema);
