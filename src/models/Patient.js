import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  mobile: { type: String, required: true, unique: true, trim: true },
  name: { type: String, trim: true },
  age: { type: Number, min: 0, max: 120 },
  city: { type: String, trim: true },
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
  fcmToken: { type: String, default: null }
}, { timestamps: true });

export const Patient = mongoose.model('Patient', patientSchema);
