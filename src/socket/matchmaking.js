const crypto = require('crypto');

// Simple in-memory queue for demo purposes.
// In production, back this with Redis (sorted sets / lists) so it works
// across multiple backend instances behind a load balancer.
const waitingQueue = []; // [{ socketId, userId, filters }]

function findMatch(filters, excludeUserId) {
  const idx = waitingQueue.findIndex((entry) => {
    if (entry.userId === excludeUserId) return false;
    if (filters.country && entry.filters.country && filters.country !== entry.filters.country) return false;
    if (filters.gender && entry.filters.gender && filters.gender !== entry.filters.gender) return false;
    return true;
  });
  return idx === -1 ? null : idx;
}

function registerMatchmaking(io, socket) {
  socket.on('match:find', ({ filters = {} }) => {
    const matchIdx = findMatch(filters, socket.user._id.toString());

    if (matchIdx !== null) {
      const partner = waitingQueue.splice(matchIdx, 1)[0];
      const roomName = `room_${crypto.randomBytes(8).toString('hex')}`;

      io.to(partner.socketId).emit('match:found', { roomName, partnerId: socket.user._id });
      socket.emit('match:found', { roomName, partnerId: partner.userId });
    } else {
      waitingQueue.push({ socketId: socket.id, userId: socket.user._id.toString(), filters });
      socket.emit('match:waiting');
    }
  });

  socket.on('match:cancel', () => {
    const idx = waitingQueue.findIndex((e) => e.socketId === socket.id);
    if (idx !== -1) waitingQueue.splice(idx, 1);
  });

  socket.on('disconnect', () => {
    const idx = waitingQueue.findIndex((e) => e.socketId === socket.id);
    if (idx !== -1) waitingQueue.splice(idx, 1);
  });
}

module.exports = { registerMatchmaking };
