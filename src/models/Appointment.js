import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  appointmentDate: { type: Date, required: true, index: true },
  tokenNumber: { type: Number, required: true },   // 1, 2, 3 ... maxSeatsPerDay
  patientSnapshot: {
    name: String,
    age: Number,
    city: String,
    gender: String,
    mobile: String
  },
  symptoms: { type: String, required: true },
  status: {
    type: String,
    enum: ['payment_pending', 'confirmed', 'waiting', 'calling', 'completed', 'cancelled', 'missed'],
    default: 'payment_pending',
    index: true
  },
  feeAmount: { type: Number, required: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
  callLog: { type: mongoose.Schema.Types.ObjectId, ref: 'CallLog' }
}, { timestamps: true });

appointmentSchema.index({ appointmentDate: 1, tokenNumber: 1 }, { unique: true });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
