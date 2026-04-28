import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: String,
  duration: String,
  instructions: String
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  diagnosis: { type: String, required: true },
  medicines: [medicineSchema],
  instructions: String,
  testsSuggested: [String],
  followUpDate: Date,
  pdfUrl: String,
  pdfStorageKey: String,
  generatedAt: Date,
  sentOnWhatsappAt: Date
}, { timestamps: true });

export const Prescription = mongoose.model('Prescription', prescriptionSchema);
