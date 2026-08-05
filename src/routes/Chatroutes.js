const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

router.use(protect);
router.get('/', chatController.getConversations);
router.post('/with/:userId', chatController.getOrCreateConversation);
router.get('/:conversationId/messages', chatController.getMessages);
router.post('/:conversationId/messages', chatController.sendMessage);

module.exports = router;