import agoraAccessToken from 'agora-access-token';
import { agoraConfig } from '../config/agora.js';

const { RtcRole, RtcTokenBuilder } = agoraAccessToken;

export const makeChannelName = (appointmentId) => `consult_${appointmentId}`;

export const generateRtcToken = ({ channelName, uid, role = 'publisher' }) => {
  if (!agoraConfig.appId || !agoraConfig.appCertificate) {
    const error = new Error('Agora credentials are not configured');
    error.statusCode = 500;
    throw error;
  }
  const expireSeconds = 60 * 60 * 2;
  const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expireSeconds;
  return {
    appId: agoraConfig.appId,
    channelName,
    uid,
    token: RtcTokenBuilder.buildTokenWithUid(
      agoraConfig.appId,
      agoraConfig.appCertificate,
      channelName,
      uid,
      role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER,
      privilegeExpiredTs
    ),
    expiresInSeconds: expireSeconds
  };
};
