const express = require('express');
const router = express.Router();
const { AccessToken } = require('livekit-server-sdk');
const { protect } = require('../middleware/auth');

router.use(protect);

// POST /api/match/token
// Issues a short-lived LiveKit room token for the matched call.
// Room name is server-generated so clients can never join arbitrary rooms.
router.post('/token', async (req, res, next) => {
  try {
    const { roomName } = req.body; // roomName assigned by matchmaking (socket) layer
    if (!roomName) return res.status(400).json({ success: false, message: 'roomName required' });

    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: req.user._id.toString(),
      ttl: '10m',
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    res.json({ success: true, token: at.toJwt(), url: process.env.LIVEKIT_URL });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
