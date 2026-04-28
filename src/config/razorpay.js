import Razorpay from 'razorpay';
import { env } from './env.js';

export const getRazorpayClient = () => {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    const error = new Error('Razorpay credentials are not configured');
    error.statusCode = 500;
    throw error;
  }
  return new Razorpay({
    key_id: env.razorpay.keyId,
    key_secret: env.razorpay.keySecret
  });
};
