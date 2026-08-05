const express = require("express");
const router = express.Router();
const { AccessToken } = require("livekit-server-sdk");
const { protect } = require("../middleware/auth");

router.use(protect);

router.post("/token", async (req, res, next) => {
  try {
    const { roomName } = req.body;

    if (!roomName) {
      return res.status(400).json({
        success: false,
        message: "roomName required",
      });
    }

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: req.user._id.toString(),
        ttl: "10m",
      }
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    console.log("Generated Token:", token.substring(0, 30) + "...");
    console.log("Room:", roomName);

    return res.json({
      success: true,
      token,
      url: process.env.LIVEKIT_URL,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;