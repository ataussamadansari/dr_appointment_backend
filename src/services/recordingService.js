/**
 * Agora Cloud Recording Service
 *
 * Fixed issues:
 * 1. fileNamePrefix — only simple strings, no slashes
 * 2. maxIdleTime increased to 120s (worker stays alive even if users join late)
 * 3. Consistent RECORDING_UID = 999999 across acquire/start/query/stop
 * 4. Consistent mode = 'mix' across all endpoints
 * 5. Detailed logging at every step
 * 6. Env validation on startup
 */

import axios from 'axios';
import { agoraConfig } from '../config/agora.js';

const BASE = 'https://api.agora.io/v1/apps';
export const RECORDING_UID = 999999; // fixed — must not match doctor(1) or patient(2)

// ── Auth ──────────────────────────────────────────────────────────────────────
const authHeader = () => ({
  Authorization: `Basic ${Buffer.from(`${agoraConfig.customerId}:${agoraConfig.customerSecret}`).toString('base64')}`,
  'Content-Type': 'application/json',
});

// ── Env validation ────────────────────────────────────────────────────────────
const REQUIRED_RECORDING_VARS = [
  'appId', 'customerId', 'customerSecret',
  'recordingBucket', 'recordingAccessKey', 'recordingSecretKey', 'recordingRegion'
];

export const validateRecordingConfig = () => {
  const missing = REQUIRED_RECORDING_VARS.filter((k) => !agoraConfig[k]);
  if (missing.length) {
    throw Object.assign(
      new Error(`Agora recording config missing: ${missing.join(', ')}`),
      { statusCode: 500 }
    );
  }
};

// Log config presence on startup (no secrets printed)
export const logRecordingConfigStatus = () => {
  console.log('[Recording] Config check:');
  console.log('  appId:           ', agoraConfig.appId       ? '✅ set' : '❌ MISSING');
  console.log('  customerId:      ', agoraConfig.customerId  ? '✅ set' : '❌ MISSING');
  console.log('  customerSecret:  ', agoraConfig.customerSecret ? `✅ set (${agoraConfig.customerSecret.slice(0,4)}***)` : '❌ MISSING');
  console.log('  recordingBucket: ', agoraConfig.recordingBucket || '❌ MISSING');
  console.log('  recordingRegion: ', agoraConfig.recordingRegion !== '' ? agoraConfig.recordingRegion : '❌ MISSING');
  console.log('  recordingVendor: ', agoraConfig.recordingVendor || '❌ MISSING');
  console.log('  accessKey:       ', agoraConfig.recordingAccessKey ? `✅ set (${agoraConfig.recordingAccessKey.slice(0,4)}***)` : '❌ MISSING');
  console.log('  secretKey:       ', agoraConfig.recordingSecretKey ? '✅ set (***)' : '❌ MISSING');
};

// ── Vendor code ───────────────────────────────────────────────────────────────
// Agora vendor codes: 1=AWS, 2=Alibaba, 3=Tencent, 5=Microsoft, 6=Google, 7=Huawei, 8=Baidu
const resolveVendorCode = (vendor) => {
  if (!vendor || vendor === 'aws' || vendor === '1' || vendor === 1) return 1;
  const n = Number(vendor);
  return isNaN(n) ? 1 : n;
};

// ── Agora S3 region codes ─────────────────────────────────────────────────────
// 0=us-east-1, 1=us-east-2, 2=us-west-1, 3=us-west-2
// 4=eu-west-1, 5=ap-southeast-1, 6=ap-northeast-1
// 7=ap-southeast-2, 8=eu-central-1, 9=ap-northeast-2, 10=ap-south-1 (Mumbai)
const resolveRegionCode = () => {
  const raw = agoraConfig.recordingRegion;
  const n = Number(raw);
  if (isNaN(n)) throw Object.assign(
    new Error(`AGORA_RECORDING_REGION must be a number (e.g. 10 for Mumbai). Got: "${raw}"`),
    { statusCode: 500 }
  );
  return n;
};

// ── Acquire ───────────────────────────────────────────────────────────────────
export const acquireRecordingResource = async ({ channelName }) => {
  validateRecordingConfig();
  const url = `${BASE}/${agoraConfig.appId}/cloud_recording/acquire`;
  console.log(`[Recording] Acquiring resource | channel: ${channelName} | uid: ${RECORDING_UID}`);

  const { data } = await axios.post(url, {
    cname: channelName,
    uid:   String(RECORDING_UID),
    clientRequest: { resourceExpiredHour: 24 }
  }, { headers: authHeader() });

  console.log('[Recording] Resource acquired:', data.resourceId?.slice(0, 20) + '...');
  return data.resourceId;
};

// ── Start ─────────────────────────────────────────────────────────────────────
export const startCloudRecording = async ({ channelName, token }) => {
  validateRecordingConfig();
  const regionCode = resolveRegionCode();
  const resourceId = await acquireRecordingResource({ channelName });

  const url = `${BASE}/${agoraConfig.appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`;

  // fileNamePrefix: simple strings only — no slashes, no special chars
  // Results in S3 path: recordings/<appointmentId>/<files>
  const appointmentId = channelName.replace('consult_', '');
  const fileNamePrefix = ['recordings', appointmentId];

  const body = {
    cname: channelName,
    uid:   String(RECORDING_UID),
    clientRequest: {
      token,
      recordingConfig: {
        maxIdleTime:     120,  // keep worker alive 120s even if channel is empty
        streamTypes:     2,    // audio + video
        channelType:     0,    // communication channel
        videoStreamType: 0,    // high stream
        subscribeUidGroup: 0,
        transcodingConfig: {
          width:           1280,
          height:          720,
          fps:             15,
          bitrate:         1130,
          mixedVideoLayout: 1,  // floating layout
        },
      },
      recordingFileConfig: {
        avFileType: ['hls', 'mp4'],
      },
      storageConfig: {
        vendor:         resolveVendorCode(agoraConfig.recordingVendor),
        region:         regionCode,
        bucket:         agoraConfig.recordingBucket,
        accessKey:      agoraConfig.recordingAccessKey,
        secretKey:      agoraConfig.recordingSecretKey,
        fileNamePrefix, // ['recordings', appointmentId]
      },
    },
  };

  console.log(`[Recording] Starting | channel: ${channelName} | uid: ${RECORDING_UID} | region: ${regionCode} | bucket: ${agoraConfig.recordingBucket} | prefix: ${fileNamePrefix.join('/')}`);

  const { data } = await axios.post(url, body, { headers: authHeader() });
  console.log('[Recording] Start response:', JSON.stringify({ sid: data.sid, resourceId: data.resourceId?.slice(0, 20) + '...' }));

  return { resourceId, sid: data.sid, raw: data };
};

// ── Query ─────────────────────────────────────────────────────────────────────
export const queryCloudRecording = async ({ channelName, resourceId, sid }) => {
  validateRecordingConfig();
  const url = `${BASE}/${agoraConfig.appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/query`;
  console.log(`[Recording] Querying | channel: ${channelName} | sid: ${sid}`);

  const { data } = await axios.get(url, { headers: authHeader() });
  const serverResponse = data?.serverResponse || {};
  console.log('[Recording] Query serverResponse:', JSON.stringify(serverResponse));

  return { raw: data, serverResponse, recordingUrl: _extractUrl(serverResponse) };
};

// ── Stop ──────────────────────────────────────────────────────────────────────
const STOP_MIN_SECONDS = 30; // Agora worker needs at least ~30s to be ready

export const stopCloudRecording = async ({ channelName, resourceId, sid, recordingStartedAt }) => {
  validateRecordingConfig();

  // Guard: don't stop too early
  if (recordingStartedAt) {
    const elapsed = (Date.now() - new Date(recordingStartedAt).getTime()) / 1000;
    if (elapsed < STOP_MIN_SECONDS) {
      const wait = Math.ceil(STOP_MIN_SECONDS - elapsed);
      throw Object.assign(
        new Error(`Recording is still initializing. Please wait ${wait} more seconds before ending the call.`),
        { statusCode: 400, code: 'RECORDING_TOO_EARLY' }
      );
    }
  }

  const url = `${BASE}/${agoraConfig.appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`;
  console.log(`[Recording] Stopping | channel: ${channelName} | sid: ${sid} | uid: ${RECORDING_UID}`);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let lastErr;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const { data } = await axios.post(url, {
        cname: channelName,
        uid:   String(RECORDING_UID),
        clientRequest: {},
      }, { headers: authHeader() });

      const serverResponse = data?.serverResponse || {};
      console.log('[Recording] Stop serverResponse:', JSON.stringify(serverResponse));

      const recordingUrl = _extractUrl(serverResponse);
      const recordingFiles = _extractFiles(serverResponse, agoraConfig.recordingBucket);

      if (recordingUrl) {
        console.log('[Recording] Stop — file URL:', recordingUrl);
      } else {
        console.warn('[Recording] Stop — fileList empty, S3 upload still in progress');
      }

      return { raw: data, serverResponse, recordingUrl, recordingFiles, resourceId, sid };
    } catch (err) {
      const errData = err?.response?.data || {};
      const code    = errData.code;
      const reason  = errData.reason || err?.message;
      lastErr = err;

      if (code === 404 && attempt < 5) {
        console.warn(`[Recording] Stop attempt ${attempt}/5 failed (worker not ready): ${reason}. Retrying in 6s...`);
        await sleep(6000);
      } else {
        console.error(`[Recording] Stop failed permanently after ${attempt} attempts:`, JSON.stringify(errData));
        throw err;
      }
    }
  }
  throw lastErr;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const _extractUrl = (serverResponse) => {
  const fileList = serverResponse?.fileList;
  if (Array.isArray(fileList) && fileList.length > 0) {
    const mp4 = fileList.find((f) => f.fileName?.endsWith('.mp4'));
    const f   = mp4 || fileList[0];
    return `https://${agoraConfig.recordingBucket}.s3.amazonaws.com/${f.fileName}`;
  }
  if (typeof fileList === 'string' && fileList.length > 0) {
    return `https://${agoraConfig.recordingBucket}.s3.amazonaws.com/${fileList}`;
  }
  return null;
};

const _extractFiles = (serverResponse, bucket) => {
  const fileList = serverResponse?.fileList;
  if (Array.isArray(fileList) && fileList.length > 0) {
    return fileList.map((f) => `https://${bucket}.s3.amazonaws.com/${f.fileName}`);
  }
  if (typeof fileList === 'string' && fileList.length > 0) {
    return [`https://${bucket}.s3.amazonaws.com/${fileList}`];
  }
  return [];
};
