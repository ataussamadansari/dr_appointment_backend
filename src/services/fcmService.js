import admin from 'firebase-admin';

// Initialize once — lazy init on first use
let _initialized = false;

const init = () => {
  if (_initialized || admin.apps.length > 0) {
    _initialized = true;
    return true;
  }

  const jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!jsonStr) {
    console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled.');
    return false;
  }

  try {
    // Official style: admin.credential.cert(serviceAccount)
    // We parse from env string instead of require("path/to/file.json")
    const serviceAccount = JSON.parse(jsonStr);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    _initialized = true;
    console.log('[FCM] Firebase Admin initialized. Project:', serviceAccount.project_id);
    return true;
  } catch (e) {
    console.error('[FCM] Init failed — check FIREBASE_SERVICE_ACCOUNT_JSON format:', e.message);
    return false;
  }
};

/**
 * Send push notification to patient when doctor starts a call.
 * Silently skips if Firebase not configured or token missing.
 */
export const sendCallNotification = async ({ fcmToken, appointmentId }) => {
  if (!fcmToken) return;
  if (!init()) return;

  try {
    const messageId = await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: '📞 Doctor is calling',
        body: 'Your doctor has started the video consultation. Tap to join.',
      },
      data: {
        appointmentId: String(appointmentId),
        type: 'call_started',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'doctor_call_channel',
          priority: 'max',
          defaultVibrateTimings: true,
          defaultSound: true,
          color: '#0D9488',
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: { sound: 'default', badge: 1, contentAvailable: true },
        },
      },
    });

    console.log('[FCM] Notification sent:', messageId);
  } catch (err) {
    // Stale/invalid token — log but don't crash
    if (
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token'
    ) {
      console.warn('[FCM] Token invalid/expired — patient should re-login to refresh token.');
    } else {
      console.error('[FCM] Send error:', err.message);
    }
  }
};
