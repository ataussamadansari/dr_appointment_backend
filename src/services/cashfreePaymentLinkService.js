import crypto from 'crypto';
import axios from 'axios';
import { env } from '../config/env.js';
import { normalizeWhatsappPhone } from './interaktService.js';

const getCashfreeBaseUrl = () => (
  env.cashfree.env === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg'
);

export const createPaymentLinkForWhatsappBooking = async (session) => {
  if (!env.cashfree.appId || !env.cashfree.secretKey) {
    const error = new Error('Cashfree credentials are not configured');
    error.statusCode = 500;
    throw error;
  }

  const linkId = `appt_${session._id}`;
  const payload = {
    link_id: linkId,
    link_amount: session.amount,
    link_currency: 'INR',
    link_purpose: 'Doctor Appointment Booking',
    customer_details: {
      customer_name: session.patientName,
      customer_phone: normalizeWhatsappPhone(session.phone)
    },
    link_notify: {
      send_sms: false,
      send_email: false
    },
    link_meta: {
      notify_url: `${env.storage.appBaseUrl.replace(/\/$/, '')}/api/cashfree/webhook`
    }
  };

  const { data } = await axios.post(`${getCashfreeBaseUrl()}/links`, payload, {
    headers: {
      'x-client-id': env.cashfree.appId,
      'x-client-secret': env.cashfree.secretKey,
      'x-api-version': env.cashfree.apiVersion,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

  return {
    linkId: data.link_id || linkId,
    linkUrl: data.link_url || data.linkUrl || data.payment_link,
    raw: data
  };
};

export const verifyCashfreeWebhookSignature = (req) => {
  const secret = env.cashfree.webhookSecret || env.cashfree.secretKey;
  if (!secret) return true;

  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  if (!signature || !timestamp || !req.rawBody) return false;

  const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : String(req.rawBody);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}${rawBody}`)
    .digest('base64');

  const provided = String(signature);
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
};

export const parseCashfreeWebhook = (payload = {}) => {
  const type = payload.type || payload.event || payload.event_type || 'unknown';
  const data = payload.data || {};
  const link = data.link || data.payment_link || data;
  const order = data.order || {};
  const payment = data.payment || {};
  const linkId = link.link_id || data.link_id || order.order_id || payload.link_id;
  const orderId = order.order_id || data.order_id || payment.order_id || payload.order_id;
  const linkStatus = String(link.link_status || data.link_status || payment.payment_status || '').toUpperCase();
  const paymentStatus = String(payment.payment_status || data.payment_status || payload.payment_status || '').toUpperCase();
  const isPaid = (
    linkStatus === 'PAID' ||
    paymentStatus === 'SUCCESS' ||
    paymentStatus === 'PAID' ||
    String(type).toUpperCase().includes('SUCCESS') ||
    String(type).toUpperCase().includes('PAID')
  );

  return { type, linkId, orderId, isPaid, linkStatus, paymentStatus };
};
