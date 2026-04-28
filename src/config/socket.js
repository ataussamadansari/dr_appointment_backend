import { Server } from 'socket.io';

let io = null;

/**
 * Initialize Socket.IO on the HTTP server.
 * Call once from server.js after app.listen().
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    // Client joins a room by their patientId or 'admin'
    socket.on('join', (room) => {
      socket.join(room);
    });

    socket.on('disconnect', () => {});
  });

  return io;
};

/** Get the io instance (after init) */
export const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

/**
 * Emit a real-time event.
 * @param {string} room  - 'admin' | patientId
 * @param {string} event - event name
 * @param {object} data  - payload
 */
export const emit = (room, event, data) => {
  try {
    getIO().to(room).emit(event, data);
  } catch (_) {
    // Socket not initialized (e.g. tests) — silently ignore
  }
};
