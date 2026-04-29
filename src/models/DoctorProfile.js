import mongoose from 'mongoose';

const doctorProfileSchema = new mongoose.Schema({
  name:           { type: String, default: 'Doctor' },
  title:          { type: String, default: 'Consultant' },       // e.g. "Dr."
  specialization: { type: String, default: '' },                  // e.g. "Neurologist"
  experience:     { type: String, default: '' },                  // e.g. "20+ years"
  photo:          { type: String, default: '' },                  // URL
  about:          { type: String, default: '' },                  // general info paragraph
  clinicName:     { type: String, default: '' },
  clinicAddress:  { type: String, default: '' },
  visitingHospitals: [{ type: String }],                          // array of hospital names
  specialties:    [{ type: String }],                             // e.g. ["Stroke", "Epilepsy"]
  education:      [{ name: String, year: String, institute: String }],
  memberships:    [{ type: String }],
  achievements:   [{ type: String }],
  languages:      [{ type: String }],
  phone:          { type: String, default: '' },
  email:          { type: String, default: '' },
}, { timestamps: true });

export const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema);
