import { WhatsappMessageLog } from '../models/WhatsappMessageLog.js';
import { parseCashfreeWebhook, verifyCashfreeWebhookSignature } from '../services/cashfreePaymentLinkService.js';
import { confirmWhatsappBookingPayment } from '../services/whatsappBookingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const cashfreeWebhook = asyncHandler(async (req, res) => {
  const valid = verifyCashfreeWebhookSignature(req);
  if (!valid) {
    await WhatsappMessageLog.create({
      direction: 'inbound',
      provider: 'cashfree',
      eventType: 'cashfree_invalid_signature',
      payload: req.body,
      status: 'rejected'
    });
    return res.status(200).json({ success: true, ignored: true });
  }

  const parsed = parseCashfreeWebhook(req.body);
  res.status(200).json({ success: true });

  if (parsed.isPaid) {
    confirmWhatsappBookingPayment({
      linkId: parsed.linkId,
      orderId: parsed.orderId,
      rawPayload: req.body
    }).catch((error) => {
      console.error('Cashfree WhatsApp booking confirmation failed:', error);
    });
  }
});

export const cashfreeHealth = asyncHandler(async (req, res) => {
  sendSuccess(res, { provider: 'cashfree', ok: true });
});
