import axios from 'axios';
import { agoraConfig } from '../config/agora.js';

const recordingBaseUrl = 'https://api.agora.io/v1/apps';

const authHeader = () => {
  const token = Buffer.from(`${agoraConfig.customerId}:${agoraConfig.customerSecret}`).toString('base64');
  return { Authorization: `Basic ${token}` };
};

const ensureRecordingConfig = () => {
  const required = ['appId', 'customerId', 'customerSecret', 'recordingBucket', 'recordingAccessKey', 'recordingSecretKey'];
  const missing = required.filter((key) => !agoraConfig[key]);
  if (missing.length) {
    const error = new Error(`Agora recording config missing: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }
};

export const acquireRecordingResource = async ({ channelName, uid }) => {
  ensureRecordingConfig();
  const url = `${recordingBaseUrl}/${agoraConfig.appId}/cloud_recording/acquire`;
  console.log('[Recording] Acquiring resource for channel:', channelName);
  const { data } = await axios.post(url, {
    cname: channelName,
    uid: String(uid),
    clientRequest: { resourceExpiredHour: 24 }
  }, { headers: authHeader() });
  console.log('[Recording] Resource acquired:', data.resourceId);
  return data.resourceId;
};

// Agora AWS S3 region codes:
// 0=US_EAST_1, 1=US_EAST_2, 2=US_WEST_1, 3=US_WEST_2,
// 4=EU_WEST_1, 5=AP_SOUTHEAST_1, 6=AP_NORTHEAST_1,
// 7=AP_SOUTHEAST_2, 8=EU_CENTRAL_1, 9=AP_NORTHEAST_2, 10=AP_SOUTH_1 (Mumbai)
const resolveVendorCode = (vendor) => {
  if (vendor === 'aws' || vendor === '1' || vendor === 1) return 1;
  const n = Number(vendor);
  return isNaN(n) ? 1 : n;
};

export const startCloudRecording = async ({ channelName, uid, token }) => {
  const resourceId = await acquireRecordingResource({ channelName, uid });

  const regionRaw = agoraConfig.recordingRegion;
  if (regionRaw === '' || regionRaw === null || regionRaw === undefined) {
    const error = new Error(
      'AGORA_RECORDING_REGION is not set. Set it to the numeric Agora region code for your S3 bucket region ' +
      '(e.g. 0=us-east-1, 3=us-west-2, 10=ap-south-1/Mumbai). See recordingService.js for full list.'
    );
    error.statusCode = 500;
    throw error;
  }

  const regionCode = Number(regionRaw);
  if (isNaN(regionCode)) {
    const error = new Error(`AGORA_RECORDING_REGION must be a number, got: "${regionRaw}"`);
    error.statusCode = 500;
    throw error;
  }

  const url = `${recordingBaseUrl}/${agoraConfig.appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`;
  console.log('[Recording] Starting cloud recording, channel:', channelName, 'region:', regionCode);

  const { data } = await axios.post(url, {
    cname: channelName,
    uid: String(uid),
    clientRequest: {
      token,
      recordingConfig: {
        maxIdleTime: 30,
        streamTypes: 2,
        channelType: 0,
        videoStreamType: 0,
        transcodingConfig: {
          width: 1280,
          height: 720,
          fps: 15,
          bitrate: 1130,
          mixedVideoLayout: 1
        }
      },
      recordingFileConfig: { avFileType: ['hls', 'mp4'] },
      storageConfig: {
        vendor: resolveVendorCode(agoraConfig.recordingVendor),
        region: regionCode,
        bucket: agoraConfig.recordingBucket,
        accessKey: agoraConfig.recordingAccessKey,
        secretKey: agoraConfig.recordingSecretKey,
        fileNamePrefix: ['doctor-consulting', channelName]
      }
    }
  }, { headers: authHeader() });

  console.log('[Recording] Started successfully. sid:', data.sid);
  return { resourceId, sid: data.sid, raw: data };
};

export const stopCloudRecording = async ({ channelName, uid, resourceId, sid }) => {
  ensureRecordingConfig();
  const url = `${recordingBaseUrl}/${agoraConfig.appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`;
  console.log('[Recording] Stopping cloud recording, channel:', channelName, 'sid:', sid);

  // Agora requires at least 3-5s after start before stop is accepted.
  // Retry up to 4 times with 5s delay on 404 "failed to find worker".
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const { data } = await axios.post(url, {
        cname: channelName,
        uid: String(uid),
        clientRequest: {}
      }, { headers: authHeader() });

      console.log('[Recording] Stop response serverResponse:', JSON.stringify(data?.serverResponse));

      const serverResponse = data?.serverResponse || {};
      const fileList = serverResponse.fileList;
      let recordingUrl = null;

      if (Array.isArray(fileList) && fileList.length > 0) {
        const mp4 = fileList.find((f) => f.fileName?.endsWith('.mp4'));
        const firstFile = mp4 || fileList[0];
        recordingUrl = `https://${agoraConfig.recordingBucket}.s3.amazonaws.com/${firstFile.fileName}`;
        console.log('[Recording] URL from fileList array:', recordingUrl);
      } else if (typeof fileList === 'string' && fileList.length > 0) {
        recordingUrl = `https://${agoraConfig.recordingBucket}.s3.amazonaws.com/${fileList}`;
        console.log('[Recording] URL from fileList string:', recordingUrl);
      } else {
        console.warn('[Recording] fileList empty at stop time — files uploading to S3 async.');
      }

      return { raw: data, recordingUrl, resourceId, sid };
    } catch (err) {
      const code = err?.response?.data?.code;
      const reason = err?.response?.data?.reason || err?.message;
      lastErr = err;

      if (code === 404 && attempt < 4) {
        console.warn(`[Recording] Stop attempt ${attempt} failed (worker not ready): ${reason}. Retrying in 5s...`);
        await sleep(5000);
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
};

// Query recording status — call this a few minutes after stop to get the file URL
export const queryCloudRecording = async ({ channelName, uid, resourceId, sid }) => {
  ensureRecordingConfig();
  const url = `${recordingBaseUrl}/${agoraConfig.appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/query`;
  console.log('[Recording] Querying recording status, sid:', sid);

  const { data } = await axios.get(url, { headers: authHeader() });
  console.log('[Recording] Query response:', JSON.stringify(data?.serverResponse));

  const fileList = data?.serverResponse?.fileList;
  let recordingUrl = null;

  if (Array.isArray(fileList) && fileList.length > 0) {
    const mp4 = fileList.find((f) => f.fileName?.endsWith('.mp4'));
    const firstFile = mp4 || fileList[0];
    recordingUrl = `https://${agoraConfig.recordingBucket}.s3.amazonaws.com/${firstFile.fileName}`;
  } else if (typeof fileList === 'string' && fileList.length > 0) {
    recordingUrl = `https://${agoraConfig.recordingBucket}.s3.amazonaws.com/${fileList}`;
  }

  return { raw: data, recordingUrl };
};
