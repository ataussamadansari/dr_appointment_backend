import axios from 'axios';
import { whatsappConfig } from '../config/whatsapp.js';
import { WhatsAppLog } from '../models/WhatsAppLog.js';

const isConfigured = () => Boolean(whatsappConfig.token && whatsappConfig.phoneNumberId);

const sendMessage = async ({ to, payload }) => {
  if (!isConfigured()) {
    return { skipped: true, reason: 'WhatsApp Cloud API is not configured' };
  }
  const url = `https://graph.facebook.com/${whatsappConfig.apiVersion}/${whatsappConfig.phoneNumberId}/messages`;
  const { data } = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${whatsappConfig.token}`,
      'Content-Type': 'application/json'
    }
  });
  return data;
};

export const sendWhatsAppText = async ({ patient, appointment, type, text }) => {
  const to = patient.mobile;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text }
  };
  try {
    const response = await sendMessage({ to, payload });
    await WhatsAppLog.create({ patient: patient._id, appointment: appointment?._id, to, type, payload, response, status: response.skipped ? 'skipped' : 'sent' });
    return response;
  } catch (err) {
    await WhatsAppLog.create({ patient: patient._id, appointment: appointment?._id, to, type, payload, status: 'failed', error: err.message });
    throw err;
  }
};

export const sendWhatsAppDocument = async ({ patient, appointment, prescription, documentUrl }) => {
  const to = patient.mobile;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document: {
      link: documentUrl,
      filename: `prescription-${appointment._id}.pdf`,
      caption: 'Your consultation prescription'
    }
  };
  try {
    const response = await sendMessage({ to, payload });
    await WhatsAppLog.create({
      patient: patient._id,
      appointment: appointment._id,
      prescription: prescription._id,
      to,
      type: 'prescription_document',
      payload,
      response,
      status: response.skipped ? 'skipped' : 'sent'
    });
    return response;
  } catch (err) {
    await WhatsAppLog.create({ patient: patient._id, appointment: appointment._id, prescription: prescription._id, to, type: 'prescription_document', payload, status: 'failed', error: err.message });
    throw err;
  }
};
