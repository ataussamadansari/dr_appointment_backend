import mongoose from 'mongoose';

const doctorSettingSchema = new mongoose.Schema({
  consultationFee: { type: Number, required: true, default: 500, min: 1 },
  maxSeatsPerDay: { type: Number, required: true, default: 20, min: 1 },
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

export const DoctorSetting = mongoose.model('DoctorSetting', doctorSettingSchema);
