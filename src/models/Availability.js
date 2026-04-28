import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  isAvailable: { type: Boolean, default: true },
  maxSeats: { type: Number, required: true },
  bookedSeats: { type: Number, default: 0 }
}, { timestamps: true });

availabilitySchema.index({ date: 1 }, { unique: true });

export const Availability = mongoose.model('Availability', availabilitySchema);
