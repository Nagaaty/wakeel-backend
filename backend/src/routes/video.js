const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const DAILY_API = 'https://api.daily.co/v1';

async function dailyRequest(path, data, method = 'POST') {
  const key = process.env.DAILY_API_KEY;
  if (!key) return null;
  const res = await fetch(`${DAILY_API}${path}`, {
    method,
    headers: { 'Content-Type':'application/json', Authorization:`Bearer ${key}` },
    body: method !== 'GET' ? JSON.stringify(data) : undefined,
  });
  return res.json();
}

// POST /api/video/room  — create or get room for a booking
router.post('/room', requireAuth, async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: 'bookingId required' });

    // Check if room already exists
    const { rows: [existing] } = await pool.query(
      `SELECT * FROM consultation_rooms WHERE booking_id=$1`, [bookingId]
    );
    if (existing) {
      return res.json({ roomUrl: existing.room_url, roomName: existing.room_name });
    }

    // Verify booking belongs to user
    const { rows: [booking] } = await pool.query(
      `SELECT b.*, lu.name as lawyer_name, cu.name as client_name
       FROM bookings b
       JOIN users lu ON lu.id=b.lawyer_id
       JOIN users cu ON cu.id=b.client_id
       WHERE b.id=$1 AND (b.client_id=$2 OR b.lawyer_id=$2)`,
      [bookingId, req.user.id]
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const roomName = `wakeel-${bookingId}-${Date.now()}`;
    let roomUrl    = `https://wakeel.daily.co/${roomName}`;
    let tokenClient = null, tokenLawyer = null;

    // Try Daily.co API
    const room = await dailyRequest('/rooms', {
      name:       roomName,
      privacy:    'private',
      properties: {
        max_participants: 2,
        exp: Math.floor(Date.now()/1000) + 7200, // 2 hours
        enable_chat: true,
        enable_screenshare: true,
        start_video_off: false,
        start_audio_off: false,
      },
    });

    if (room?.url) {
      roomUrl = room.url;

      // Generate participant tokens
      const makeToken = (isOwner) => dailyRequest('/meeting-tokens', {
        properties: {
          room_name:  roomName,
          is_owner:   isOwner,
          exp:        Math.floor(Date.now()/1000) + 7200,
          user_name:  isOwner ? booking.lawyer_name : booking.client_name,
        },
      });

      const [lt, ct] = await Promise.all([makeToken(true), makeToken(false)]);
      tokenLawyer  = lt?.token;
      tokenClient  = ct?.token;
    }

    // Save room to DB
    await pool.query(
      `INSERT INTO consultation_rooms (booking_id, provider, room_name, room_url, token_client, token_lawyer)
       VALUES ($1,'daily',$2,$3,$4,$5)`,
      [bookingId, roomName, roomUrl, tokenClient, tokenLawyer]
    );

    // Return appropriate token based on role
    const isLawyer = booking.lawyer_id === req.user.id;
    const myToken  = isLawyer ? tokenLawyer : tokenClient;

    res.json({
      roomUrl,
      roomName,
      token:   myToken,
      simulated: !room?.url,
    });
  } catch (err) { next(err); }
});

// POST /api/video/end  — mark session as ended
router.post('/end', requireAuth, async (req, res, next) => {
  try {
    const { bookingId, durationMin } = req.body;
    await pool.query(
      `UPDATE consultation_rooms SET ended_at=NOW(), duration_min=$1 WHERE booking_id=$2`,
      [durationMin || null, bookingId]
    );
    await pool.query(
      `UPDATE bookings SET status='completed' WHERE id=$1 AND status='confirmed'`,
      [bookingId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/video/token/:bookingId  — get participant token
router.get('/token/:bookingId', requireAuth, async (req, res, next) => {
  try {
    const { rows: [room] } = await pool.query(
      `SELECT cr.*, b.lawyer_id, b.client_id
       FROM consultation_rooms cr
       JOIN bookings b ON b.id=cr.booking_id
       WHERE cr.booking_id=$1`,
      [req.params.bookingId]
    );
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isLawyer = room.lawyer_id === req.user.id;
    res.json({
      roomUrl:  room.room_url,
      token:    isLawyer ? room.token_lawyer : room.token_client,
    });
  } catch (err) { next(err); }
});

module.exports = router;
