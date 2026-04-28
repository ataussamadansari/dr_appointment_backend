import http from 'node:http';
import dns from 'node:dns/promises';
import { app } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { initSocket } from './config/socket.js';
import { logRecordingConfigStatus } from './services/recordingService.js';

dns.setServers(['1.1.1.1', '8.8.8.8']);

connectDb()
  .then(() => {
    const httpServer = http.createServer(app);
    initSocket(httpServer);

    logRecordingConfigStatus(); // print config status on startup

    httpServer.listen(env.port, '0.0.0.0', () => {
      console.log(`Backend running on port ${env.port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
