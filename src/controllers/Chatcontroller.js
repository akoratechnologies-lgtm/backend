const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { emitToRoom } = require('../socket/io');

function otherParticipant(conversation, myId) {
  return conversation.participants.find((p) => String(p._id) !== String(myId));
}

// GET /api/chats   (protected) — conversation list for the Messages tab
exports.getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'fullName username profilePhoto isOnline')
      .sort({ lastMessageAt: -1 });

    const results = conversations.map((c) => {
      const other = otherParticipant(c, req.user._id);
      return {
        id: c._id,
        user: other
          ? {
              id: other._id,
              name: other.fullName || other.username || 'AKORA user',
              avatar: other.profilePhoto || '',
              isOnline: !!other.isOnline,
            }
          : null,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        lastMessageIsMine: String(c.lastMessageSender) === String(req.user._id),
      };
    });

    res.json({ success: true, conversations: results });
  } catch (err) {
    next(err);
  }
};

// POST /api/chats/with/:userId   (protected)
// Finds the existing 1-on-1 conversation with this user, or creates one.
// Called when opening a DM from a profile/search result/video call for the
// first time — safe to call repeatedly, never creates duplicates.
exports.getOrCreateConversation = async (req, res, next) => {
  try {
    const otherId = req.params.userId;
    if (otherId === String(req.user._id)) {
      return res.status(422).json({ success: false, message: "You can't message yourself." });
    }

    const otherUser = await User.findById(otherId).select('fullName username profilePhoto isOnline');
    if (!otherUser) return res.status(404).json({ success: false, message: 'User not found.' });

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, otherId], $size: 2 },
    });

    if (!conversation) {
      conversation = await Conversation.create({ participants: [req.user._id, otherId] });
    }

    res.json({
      success: true,
      conversation: {
        id: conversation._id,
        user: {
          id: otherUser._id,
          name: otherUser.fullName || otherUser.username || 'AKORA user',
          avatar: otherUser.profilePhoto || '',
          isOnline: !!otherUser.isOnline,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/chats/:conversationId/messages   (protected)
exports.getMessages = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || !conversation.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    const messages = await Message.find({ conversation: conversation._id })
      .sort({ createdAt: 1 })
      .limit(200);

    res.json({
      success: true,
      messages: messages.map((m) => ({
        id: m._id,
        text: m.text,
        fromMe: String(m.sender) === String(req.user._id),
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/chats/:conversationId/messages   (protected)   body: { text }
exports.sendMessage = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(422).json({ success: false, message: 'Message text is required.' });
    }

    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || !conversation.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      text: text.trim(),
    });

    conversation.lastMessage = message.text;
    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessageSender = req.user._id;
    await conversation.save();

    const payload = {
      id: message._id,
      conversationId: conversation._id,
      text: message.text,
      fromMe: false, // overwritten per-recipient below
      createdAt: message.createdAt,
      sender: {
        id: req.user._id,
        name: req.user.fullName || req.user.username || 'AKORA user',
        avatar: req.user.profilePhoto || '',
      },
    };

    // Deliver instantly to the other participant if they're online — this is
    // what makes chat "real time" instead of poll-on-refresh.
    const recipientId = conversation.participants.find((p) => String(p) !== String(req.user._id));
    if (recipientId) {
      emitToRoom(`user:${recipientId}`, 'chat:message', payload);
    }

    res.status(201).json({
      success: true,
      message: { id: message._id, text: message.text, fromMe: true, createdAt: message.createdAt },
    });
  } catch (err) {
    next(err);
  }
};