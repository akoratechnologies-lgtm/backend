let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function getIO() {
  return ioInstance;
}

// Safe emit — no-ops if sockets haven't initialized yet (e.g. in tests),
// instead of crashing every admin action that tries to notify clients.
function emitToAll(event, payload) {
  if (!ioInstance) return;
  ioInstance.emit(event, payload);
}

function emitToRoom(room, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(room).emit(event, payload);
}

module.exports = { setIO, getIO, emitToAll, emitToRoom };