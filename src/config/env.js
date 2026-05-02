import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/doctor_consulting',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  admin: {
    name: process.env.ADMIN_NAME || 'Doctor Admin',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'admin123456'
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || ''
  },
  agora: {
    appId: process.env.AGORA_APP_ID || '',
    appCertificate: process.env.AGORA_APP_CERTIFICATE || '',
    customerId: process.env.AGORA_CUSTOMER_ID || '',
    customerSecret: process.env.AGORA_CUSTOMER_SECRET || '',
    recordingVendor: process.env.AGORA_RECORDING_VENDOR || 'aws',
    recordingRegion: process.env.AGORA_RECORDING_REGION || '',
    recordingBucket: process.env.AGORA_RECORDING_BUCKET || '',
    recordingAccessKey: process.env.AGORA_RECORDING_ACCESS_KEY || '',
    recordingSecretKey: process.env.AGORA_RECORDING_SECRET_KEY || ''
  },
  whatsapp: {
    token: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
    interaktApiKey: process.env.INTERAKT_API_KEY || '',
    interaktApiBaseUrl: process.env.INTERAKT_API_BASE_URL || process.env.INTERAKT_BASE_URL || 'https://api.interakt.ai/v1/public',
    interaktWebhookSecret: process.env.INTERAKT_WEBHOOK_SECRET || '',
    interaktDefaultCountryCode: process.env.INTERAKT_DEFAULT_COUNTRY_CODE || process.env.INTERAKT_COUNTRY_CODE || '91',
    interaktOtpTemplateName: process.env.INTERAKT_OTP_TEMPLATE_NAME || 'otp_authentication'
  },
  cashfree: {
    env: process.env.CASHFREE_ENV || 'sandbox',
    appId: process.env.CASHFREE_APP_ID || '',
    secretKey: process.env.CASHFREE_SECRET_KEY || '',
    apiVersion: process.env.CASHFREE_API_VERSION || '2025-01-01',
    webhookSecret: process.env.CASHFREE_WEBHOOK_SECRET || '',
    consultationFee: Number(process.env.CONSULTATION_FEE || 500),
    maxDailyTokens: Number(process.env.MAX_DAILY_TOKENS || 20)
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5000',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    awsRegion: process.env.AWS_REGION || '',
    awsBucket: process.env.AWS_BUCKET || ''
  },
  firebase: {
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ''
  }
};
