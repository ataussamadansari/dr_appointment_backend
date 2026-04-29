import { DoctorProfile } from '../models/DoctorProfile.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

// Ensure one profile always exists
const getOrCreate = async () => {
  let profile = await DoctorProfile.findOne();
  if (!profile) {
    profile = await DoctorProfile.create({
      name:           'Dr. S. K. Poddar',
      title:          'Consultant Neurologist',
      tagline:        'Your health, our priority',
      about:          'Dr. S K Poddar is an experienced Consultant Neurologist in Varanasi, practicing at the Neurology Center located at Gurudham Colony. He is also a visiting consultant at Galaxy Hospital and Varanasi Hospital. With over two decades of experience in the field of Neurology, Dr. Poddar specializes in the treatment of stroke, epilepsy and neuromuscular disorders.',
      generalInfo:    'Apart from his clinical practice, Dr. SK Poddar is associated with several non-governmental organisations (NGOs), and has been running a rural epilepsy detection program for the last many years.',
      clinicName:     'Neurology Centre',
      clinicAddress:  'Gurudham Colony, Varanasi',
      visitingHospitals: ['Galaxy Hospital', 'Varanasi Hospital'],
      experienceYears: 20,
      specializations: ['Stroke', 'Epilepsy', 'Neuromuscular Disorders', 'Neurology'],
      education:      [],
      memberships:    [],
      achievements:   [],
      languages:      ['Hindi', 'English'],
    });
  }
  return profile;
};

// ── Public — no auth required ─────────────────────────────────────────────────
export const getPublicProfile = asyncHandler(async (req, res) => {
  const profile = await getOrCreate();
  sendSuccess(res, profile);
});

// ── Admin — get full profile ──────────────────────────────────────────────────
export const getAdminProfile = asyncHandler(async (req, res) => {
  const profile = await getOrCreate();
  sendSuccess(res, profile);
});

// ── Admin — update profile ────────────────────────────────────────────────────
export const updateDoctorProfile = asyncHandler(async (req, res) => {
  const allowed = [
    'name', 'title', 'photo', 'tagline',
    'about', 'generalInfo',
    'clinicName', 'clinicAddress', 'visitingHospitals',
    'experienceYears', 'specializations',
    'education', 'memberships', 'achievements', 'languages',
    'phone', 'email', 'website',
    'consultationFeeNote', 'isPublished',
  ];

  const update = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  });

  const profile = await DoctorProfile.findOneAndUpdate(
    {},
    { $set: update },
    { new: true, upsert: true, runValidators: true }
  );
  sendSuccess(res, profile, 'Doctor profile updated');
});
