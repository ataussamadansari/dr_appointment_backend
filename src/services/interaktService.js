import axios from 'axios';
import { env } from '../config/env.js';
import { WhatsappMessageLog } from '../models/WhatsappMessageLog.js';

export const normalizeWhatsappPhone = (phone) => {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  let digits = raw.replace(/[^\d]/g, '');
  const countryCode = String(env.whatsapp.interaktDefaultCountryCode || '91').replace(/[^\d]/g, '');
  if (digits.length === 10 && countryCode) digits = `${countryCode}${digits}`;
  return digits;
};

const getNested = (obj, paths) => {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => {
      if (acc === undefined || acc === null) return undefined;
      if (Array.isArray(acc) && /^\d+$/.test(key)) return acc[Number(key)];
      return acc[key];
    }, obj);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const getMessageUrl = () => {
  const base = env.whatsapp.interaktApiBaseUrl.replace(/\/$/, '');
  return base.endsWith('/message') ? `${base}/` : `${base}/message/`;
};

export const parseInteraktWebhookPayload = (payload = {}) => {
  const eventType = getNested(payload, [
    'event',
    'event_type',
    'eventType',
    'type',
    'topic',
    'data.event',
    'data.event_type',
    'data.type'
  ]) || 'unknown';

  const phone = normalizeWhatsappPhone(getNested(payload, [
    'wa_id',
    'phone',
    'customer.phone',
    'customer.phone_number',
    'customer.phoneNumber',
    'data.phone',
    'data.customer.phone',
    'data.customer.phone_number',
    'data.customer.phoneNumber',
    'data.message.from',
    'data.message.phone_number',
    'data.user.phone_number',
    'entry.0.changes.0.value.messages.0.from',
    'entry.0.changes.0.value.contacts.0.wa_id'
  ]));

  const text = String(getNested(payload, [
    'text',
    'message',
    'message.text',
    'message.body',
    'message.message',
    'data.text',
    'data.message.text',
    'data.message.body',
    'data.message.message',
    'data.message.text.body',
    'entry.0.changes.0.value.messages.0.text.body'
  ]) || '').trim();

  const customerName = getNested(payload, [
    'customer.name',
    'customer.full_name',
    'data.customer.name',
    'data.customer.full_name',
    'data.user.name',
    'entry.0.changes.0.value.contacts.0.profile.name'
  ]);

  const direction = String(getNested(payload, [
    'direction',
    'data.direction',
    'message.direction',
    'data.message.direction'
  ]) || '').toLowerCase();

  const eventLower = String(eventType || '').toLowerCase();
  const isIncomingCustomerMessage = Boolean(
    phone &&
    text &&
    (
      direction === 'inbound' ||
      direction === 'incoming' ||
      eventLower.includes('message_received') ||
      eventLower.includes('message received') ||
      eventLower.includes('message') ||
      payload.entry?.[0]?.changes?.[0]?.value?.messages?.length
    ) &&
    !eventLower.includes('status') &&
    !eventLower.includes('sent') &&
    !eventLower.includes('delivered') &&
    !eventLower.includes('read')
  );

  return { eventType, phone, text, customerName, isIncomingCustomerMessage };
};

export const sendTextMessage = async (phone, message) => {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const url = getMessageUrl();
  const payload = {
    countryCode: `+${String(env.whatsapp.interaktDefaultCountryCode || '91').replace(/[^\d]/g, '')}`,
    phoneNumber: normalizedPhone,
    type: 'Text',
    data: { message }
  };

  if (!env.whatsapp.interaktApiKey) {
    const response = { success: false, error: 'INTERAKT_API_KEY is not configured' };
    await WhatsappMessageLog.create({
      phone: normalizedPhone,
      direction: 'outbound',
      provider: 'interakt',
      messageText: message,
      payload,
      response,
      status: 'failed'
    });
    return response;
  }

  try {
    const { data, status } = await axios.post(url, payload, {
      headers: {
        Authorization: `Basic ${env.whatsapp.interaktApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    await WhatsappMessageLog.create({
      phone: normalizedPhone,
      direction: 'outbound',
      provider: 'interakt',
      messageText: message,
      payload,
      response: data,
      status: status >= 200 && status < 300 ? 'sent' : 'failed'
    });
    return { success: true, status, data };
  } catch (error) {
    const response = {
      success: false,
      status: error.response?.status,
      error: error.response?.data || error.message
    };
    await WhatsappMessageLog.create({
      phone: normalizedPhone,
      direction: 'outbound',
      provider: 'interakt',
      messageText: message,
      payload,
      response,
      status: 'failed'
    });
    return response;
  }
};

export const sendTemplateMessage = async (phone, { templateName, bodyValues = [] }) => {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const url = getMessageUrl();
  const payload = {
    countryCode: `+${String(env.whatsapp.interaktDefaultCountryCode || '91').replace(/[^\d]/g, '')}`,
    phoneNumber: normalizedPhone,
    type: 'Template',
    template: {
      name: templateName,
      languageCode: 'en',
      bodyValues
    }
  };

  if (!env.whatsapp.interaktApiKey) {
    const response = { success: false, error: 'INTERAKT_API_KEY is not configured' };
    await WhatsappMessageLog.create({
      phone: normalizedPhone,
      direction: 'outbound',
      provider: 'interakt',
      eventType: 'template',
      messageText: templateName,
      payload,
      response,
      status: 'failed'
    });
    return response;
  }

  try {
    const { data, status } = await axios.post(url, payload, {
      headers: {
        Authorization: `Basic ${env.whatsapp.interaktApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    await WhatsappMessageLog.create({
      phone: normalizedPhone,
      direction: 'outbound',
      provider: 'interakt',
      eventType: 'template',
      messageText: templateName,
      payload,
      response: data,
      status: status >= 200 && status < 300 ? 'sent' : 'failed'
    });
    return { success: true, status, data };
  } catch (error) {
    const response = {
      success: false,
      status: error.response?.status,
      error: error.response?.data || error.message
    };
    await WhatsappMessageLog.create({
      phone: normalizedPhone,
      direction: 'outbound',
      provider: 'interakt',
      eventType: 'template',
      messageText: templateName,
      payload,
      response,
      status: 'failed'
    });
    return response;
  }
};
