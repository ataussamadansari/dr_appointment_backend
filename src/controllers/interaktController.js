import { env } from '../config/env.js';
import { WhatsappMessageLog } from '../models/WhatsappMessageLog.js';
import { handleIncomingWhatsappMessage } from '../services/whatsappBookingService.js';
import { parseInteraktWebhookPayload, sendTextMessage } from '../services/interaktService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

const isWebhookSecretValid = (req) => {
  if (!env.whatsapp.interaktWebhookSecret) return true;
  const provided = req.headers['x-interakt-webhook-secret'] || req.headers['x-webhook-secret'];
  return provided === env.whatsapp.interaktWebhookSecret;
};

export const interaktHealth = asyncHandler(async (req, res) => {
  sendSuccess(res, { provider: 'interakt', ok: true });
});

export const interaktWebhook = asyncHandler(async (req, res) => {
  if (!isWebhookSecretValid(req)) {
    await WhatsappMessageLog.create({
      direction: 'inbound',
      provider: 'interakt',
      eventType: 'invalid_secret',
      payload: req.body,
      status: 'rejected'
    });
    return res.status(200).json({ success: true, ignored: true });
  }

  const parsed = parseInteraktWebhookPayload(req.body);
  await WhatsappMessageLog.create({
    phone: parsed.phone,
    direction: 'inbound',
    provider: 'interakt',
    eventType: parsed.eventType,
    messageText: parsed.text,
    payload: req.body,
    status: parsed.isIncomingCustomerMessage ? 'received' : 'ignored'
  });

  res.status(200).json({ success: true });

  if (parsed.isIncomingCustomerMessage) {
    handleIncomingWhatsappMessage({
      phone: parsed.phone,
      text: parsed.text,
      rawPayload: req.body,
      customerName: parsed.customerName
    }).catch((error) => {
      console.error('Interakt booking flow failed:', error);
    });
  }
});

export const sendInteraktTestMessage = asyncHandler(async (req, res) => {
  const response = await sendTextMessage(req.body.phone, req.body.message || 'Test message from doctor admin panel');
  sendSuccess(res, response, response.success ? 'Test message sent' : 'Test message failed');
});
