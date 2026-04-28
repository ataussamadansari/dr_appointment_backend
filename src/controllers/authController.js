import { body } from 'express-validator';
import { Admin } from '../models/Admin.js';
import { Patient } from '../models/Patient.js';
import { sendOtp, verifyOtp } from '../services/otpService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { signToken } from '../utils/tokenHelper.js';

export const sendOtpValidation = [body('mobile').isMobilePhone('any').withMessage('Valid mobile number is required')];
export const verifyOtpValidation = [
  body('mobile').isMobilePhone('any'),
  body('otp').isLength({ min: 4, max: 8 })
];
export const adminLoginValidation = [body('email').isEmail(), body('password').isLength({ min: 8 })];

export const sendPatientOtp = asyncHandler(async (req, res) => {
  const result = await sendOtp(req.body.mobile);
  sendSuccess(res, result, 'OTP sent');
});

export const verifyPatientOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;
  const ok = await verifyOtp(mobile, otp);
  if (!ok) {
    const error = new Error('Invalid or expired OTP');
    error.statusCode = 401;
    throw error;
  }
  const patient = await Patient.findOneAndUpdate(
    { mobile },
    { $setOnInsert: { mobile } },
    { new: true, upsert: true }
  );
  const token = signToken({ id: patient._id, role: 'patient' });
  sendSuccess(res, { token, patient }, 'Login successful');
});

export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email }).select('+password');
  if (!admin || !(await admin.comparePassword(password))) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }
  const token = signToken({ id: admin._id, role: 'admin' });
  sendSuccess(res, { token, admin: { id: admin._id, name: admin.name, email: admin.email } }, 'Admin login successful');
});
