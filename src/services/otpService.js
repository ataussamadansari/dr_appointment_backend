import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { Otp } from '../models/Otp.js';
import { sendTemplateMessage, sendTextMessage } from './interaktService.js';

export const sendOtp = async (mobile) => {
  const code = process.env.NODE_ENV === 'production'
    ? String(Math.floor(100000 + Math.random() * 900000))
    : '123456';
  const codeHash = await bcrypt.hash(code, 10);
  await Otp.deleteMany({ mobile, consumedAt: null });
  await Otp.create({
    mobile,
    codeHash,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  });

  const response = await sendTemplateMessage(mobile, {
    templateName: env.whatsapp.interaktOtpTemplateName,
    bodyValues: [code]
  });

  if (!response.success) {
    await sendTextMessage(mobile, `Your OTP is ${code}. It is valid for 5 minutes.`);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Development OTP for ${mobile}: ${code}`);
  }
  return { expiresInSeconds: 300 };
};

export const verifyOtp = async (mobile, code) => {
  const otp = await Otp.findOne({ mobile, consumedAt: null }).sort({ createdAt: -1 });
  if (!otp || otp.expiresAt < new Date()) return false;
  if (otp.attempts >= 5) return false;

  const ok = await bcrypt.compare(code, otp.codeHash);
  otp.attempts += 1;
  if (ok) otp.consumedAt = new Date();
  await otp.save();
  return ok;
};
