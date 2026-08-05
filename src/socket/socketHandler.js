const { Server } = require('socket.io');
const crypto = require('crypto');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const logger = require('../utils/logger');
const { setIO } = require('./io');

// In-memory matchmaking queue: { socketId, userId, voiceOnly, joinedAt }[]
// NOTE: this queue lives in this Node process's memory. That's correct and
// sufficient for a single backend instance. If you later scale to multiple
// server instances behind a load balancer, you'll need the Socket.IO Redis
// adapter (socket.io-redis) so all instances share one matchmaking pool —
// not implemented here, flagging it honestly rather than pretending this
// already handles horizontal scaling.
let waitingQueue = [];

// roomName -> { userA, userB } (socket ids), so we know who to notify when
// one side skips/leaves.
const activeRooms = new Map();

function removeFromQueue(socketId) {
  waitingQueue = waitingQueue.filter((entry) => entry.socketId !== socketId);
}

function findPartnerIndex(forEntry) {
  // Simple FIFO match: first other waiting user, same voice/video mode.
  return waitingQueue.findIndex(
    (entry) => entry.socketId !== forEntry.socketId && entry.voiceOnly === forEntry.voiceOnly
  );
}

module.exports = function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: '*' }, // tighten this to CLIENT_ORIGIN in production
  });

  setIO(io);

  // Auth: client connects with `io(url, { auth: { token } })`. Reuses the
  // same access token issued by /api/auth — no separate socket login step.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No auth token provided'));

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select('fullName username profilePhoto country isBanned');
      if (!user || user.isBanned) return next(new Error('Not authorized'));

      socket.userId = String(user._id);
      socket.userInfo = {
        id: String(user._id),
        name: user.fullName || user.username || 'AKORA user',
        avatar: user.profilePhoto || '',
        country: user.country || '',
      };
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.userId}`);

    // Lets admin broadcasts target everyone or just one country, and lets
    // billing/gift-catalog change events reach every connected client.
    socket.join('all');
    socket.join(`user:${socket.userId}`);
    if (socket.userInfo?.country) socket.join(`country:${socket.userInfo.country}`);

    socket.on('queue:join', ({ voiceOnly = false } = {}) => {
      // Don't double-queue the same user (e.g. duplicate taps).
      removeFromQueue(socket.id);

      const me = { socketId: socket.id, userId: socket.userId, voiceOnly, joinedAt: Date.now() };
      const partnerIdx = findPartnerIndex(me);

      if (partnerIdx === -1) {
        waitingQueue.push(me);
        socket.emit('queue:waiting');
        return;
      }

      const partnerEntry = waitingQueue[partnerIdx];
      waitingQueue.splice(partnerIdx, 1);

      const partnerSocket = io.sockets.sockets.get(partnerEntry.socketId);
      if (!partnerSocket) {
        // Partner disconnected between being queued and matched — requeue me.
        waitingQueue.push(me);
        socket.emit('queue:waiting');
        return;
      }

      const roomName = `call-${crypto.randomUUID()}`;
      activeRooms.set(roomName, { a: socket.id, b: partnerSocket.id });

      socket.join(roomName);
      partnerSocket.join(roomName);

      socket.emit('match:found', { roomName, partner: partnerSocket.userInfo });
      partnerSocket.emit('match:found', { roomName, partner: socket.userInfo });
    });

    socket.on('queue:leave', () => {
      removeFromQueue(socket.id);
    });

    socket.on('call:leave', ({ roomName }) => {
      const room = activeRooms.get(roomName);
      if (!room) return;
      activeRooms.delete(roomName);
      const otherId = room.a === socket.id ? room.b : room.a;
      const otherSocket = io.sockets.sockets.get(otherId);
      otherSocket?.emit('call:partner-left');
    });

    socket.on('disconnect', () => {
      removeFromQueue(socket.id);
      for (const [roomName, room] of activeRooms.entries()) {
        if (room.a === socket.id || room.b === socket.id) {
          activeRooms.delete(roomName);
          const otherId = room.a === socket.id ? room.b : room.a;
          io.sockets.sockets.get(otherId)?.emit('call:partner-left');
        }
      }
      logger.info(`Socket disconnected: ${socket.userId}`);
    });
  });

  return io;
};