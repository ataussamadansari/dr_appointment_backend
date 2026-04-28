import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  mobile: { type: String, required: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  consumedAt: Date,
  attempts: { type: Number, default: 0 }
}, { timestamps: true });

export const Otp = mongoose.model('Otp', otpSchema);
