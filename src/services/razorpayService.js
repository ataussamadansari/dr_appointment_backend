import crypto from 'crypto';
import { getRazorpayClient } from '../config/razorpay.js';
import { env } from '../config/env.js';

export const createRazorpayOrder = async ({ amount, receipt }) => {
  return getRazorpayClient().orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt,
    payment_capture: 1
  });
};

export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  if (!env.razorpay.keySecret) {
    const error = new Error('Razorpay credentials are not configured');
    error.statusCode = 500;
    throw error;
  }
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(body)
    .digest('hex');
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};
