const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth");
const chatController = require("../controllers/chatController");

router.use(protect);

// Conversation list
router.get(
  "/conversations",
  chatController.getConversations
);

// Create or get existing 1-to-1 conversation
router.post(
  "/conversations",
  chatController.getOrCreateConversation
);

// Get messages
router.get(
  "/conversations/:conversationId/messages",
  chatController.getMessages
);

// Send message
router.post(
  "/conversations/:conversationId/messages",
  chatController.sendMessage
);

module.exports = router;