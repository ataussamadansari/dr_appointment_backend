import mongoose from 'mongoose';

const symptomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  description: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

symptomSchema.index({ sortOrder: 1, name: 1 });

export const Symptom = mongoose.model('Symptom', symptomSchema);
