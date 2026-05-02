import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  source: { type: String, enum: ['app', 'whatsapp'], default: 'app', index: true },
  patientName: { type: String, trim: true },
  age: { type: Number, min: 0, max: 120 },
  city: { type: String, trim: true },
  phone: { type: String, trim: true, index: true },
  appointmentDate: { type: Date, required: true, index: true },
  tokenNumber: { type: Number, required: true },   // 1, 2, 3 ... maxSeatsPerDay
  tokenLabel: { type: String, trim: true },
  patientSnapshot: {
    name: String,
    age: Number,
    city: String,
    gender: String,
    mobile: String
  },
  patientType: { type: String, enum: ['old', 'new'], default: 'old' },
  lastPrescriptionDate: Date,
  prescriptionPhotoUrl: String,
  prescriptionPhotoKey: String,
  symptomIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Symptom' }],
  symptoms: { type: String, required: true },
  status: {
    type: String,
    enum: ['payment_pending', 'confirmed', 'waiting', 'calling', 'completed', 'cancelled', 'missed'],
    default: 'payment_pending',
    index: true
  },
  feeAmount: { type: Number, required: true },
  amount: Number,
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'expired'], default: 'pending' },
  cashfreeLinkId: { type: String, index: true },
  cashfreePaymentRaw: mongoose.Schema.Types.Mixed,
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
  callLog: { type: mongoose.Schema.Types.ObjectId, ref: 'CallLog' }
}, { timestamps: true });

appointmentSchema.index({ appointmentDate: 1, tokenNumber: 1 }, { unique: true });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
