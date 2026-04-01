// ─── Socket.io Real-time Server ────────────────────────────────────────────────
// Handles: live chat, typing indicators, online presence, notifications

const jwt  = require('jsonwebtoken');
const pool = require('../config/db');
const { notifyNewMessage } = require('./push');

const onlineUsers = new Map(); // userId → Set of socket IDs

function initSocket(server) {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  // ── Auth middleware ────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('No token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch { next(new Error('Invalid token')); }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`🔌 Socket connected: user ${userId}`);

    // Track online users
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Mark user as online in DB
    await pool.query(`UPDATE users SET is_online=true, last_active_at=NOW() WHERE id=$1`, [userId]).catch(() => {});

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Tell others this user is online
    socket.broadcast.emit('user:online', { userId });

    // ── Join a conversation room ─────────────────────────────────────────────
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    // ── Send message ─────────────────────────────────────────────────────────
    socket.on('message:send', async ({ conversationId, content, attachmentUrl }) => {
      if (!content?.trim() && !attachmentUrl) return;
      try {
        // Save to DB
        const { rows: [msg] } = await pool.query(`
          INSERT INTO messages (conversation_id, sender_id, content, attachment_url)
          VALUES ($1, $2, $3, $4) RETURNING *
        `, [conversationId, userId, content?.trim() || '', attachmentUrl || null]);

        // Get conversation participants
        const { rows } = await pool.query(
          `SELECT client_id, lawyer_id FROM conversations WHERE id=$1`, [conversationId]
        );
        const conv = rows[0];

        // Broadcast to conversation room
        io.to(`conv:${conversationId}`).emit('message:new', {
          ...msg, sender_id: userId,
        });

        // Send push to recipient
        const recipientId = conv?.client_id === userId ? conv?.lawyer_id : conv?.client_id;
        if (recipientId && !onlineUsers.has(recipientId)) {
          const { rows: [sender] } = await pool.query('SELECT name FROM users WHERE id=$1', [userId]);
          await notifyNewMessage(recipientId, {
            senderName: sender?.name || 'شخص ما',
            preview:    content?.slice(0, 80) || '📎 مرفق',
          }).catch(() => {});
        }

        // Update conversation last message
        await pool.query(
          `UPDATE conversations SET last_message=$1, last_message_at=NOW() WHERE id=$2`,
          [content?.slice(0,100) || '📎 مرفق', conversationId]
        ).catch(() => {});

      } catch (err) { console.error('[Socket message error]', err.message); }
    });

    // ── Typing indicator ─────────────────────────────────────────────────────
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', { userId });
    });
    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', { userId });
    });

    // ── Read receipts ─────────────────────────────────────────────────────────
    socket.on('messages:read', async ({ conversationId }) => {
      await pool.query(
        `UPDATE messages SET read_at=NOW() WHERE conversation_id=$1 AND sender_id!=$2 AND read_at IS NULL`,
        [conversationId, userId]
      ).catch(() => {});
      socket.to(`conv:${conversationId}`).emit('messages:read', { conversationId, readBy: userId });
    });

    // ── Notify a specific user ────────────────────────────────────────────────
    socket.on('notify:user', ({ targetUserId, notification }) => {
      io.to(`user:${targetUserId}`).emit('notification:new', notification);
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          await pool.query(`UPDATE users SET is_online=false, last_active_at=NOW() WHERE id=$1`, [userId]).catch(() => {});
          socket.broadcast.emit('user:offline', { userId });
        }
      }
      console.log(`🔌 Socket disconnected: user ${userId}`);
    });
  });

  return io;
}

function isUserOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

function emitToUser(io, userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}

module.exports = { initSocket, isUserOnline, emitToUser };
