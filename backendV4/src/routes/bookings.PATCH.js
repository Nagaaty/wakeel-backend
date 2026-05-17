// ─── Wakeel — Backend Patch: Booking Service-Type Validation ─────────────────
// File: backend/src/routes/bookings.js
//
// One change: insert a service-type check inside the existing POST / handler,
// right after the double-booking clash check.
//
// Locate this block in your current bookings.js (around line 32-37):
//
//   // Check no double-booking
//   const { rows: [clash] } = await pool.query(
//     `SELECT id FROM bookings WHERE lawyer_id=$1 AND scheduled_at = $2::TIMESTAMP
//      AND status NOT IN ('cancelled','rejected')`,
//     [lawyerId, scheduledAt]
//   );
//   if (clash) return res.status(409).json({ message: 'This time slot is already booked' });
//
// Paste the following block IMMEDIATELY AFTER that `if (clash) return …` line.
// ─────────────────────────────────────────────────────────────────────────────


// ─── Service-type validation ─────────────────────────────────────────────────
// Reject the booking if the lawyer has marked this service type as unavailable
// for the requested date — either via the weekly default or a per-date
// override. Uses the resolve_lawyer_services() SQL function from migration 003.
{
  const requestedType = (serviceType || 'video').toLowerCase();
  const VALID = new Set(['video','text','phone','inperson','document','chat']);
  if (!VALID.has(requestedType)) {
    return res.status(400).json({ message: 'Invalid service type' });
  }
  // 'chat' from legacy clients maps to 'text' for the availability check
  const checkType = requestedType === 'chat' ? 'text' : requestedType;

  try {
    const { rows: [{ services }] } = await pool.query(
      `SELECT resolve_lawyer_services($1, $2::date) AS services`,
      [lawyerId, bookingDate]
    );
    const allowed = Array.isArray(services) ? services : [];
    if (!allowed.includes(checkType)) {
      return res.status(409).json({
        message: 'This consultation type is not offered by the lawyer on this date',
        message_ar: 'المحامي لا يقبل هذا النوع من الاستشارات في هذا التاريخ',
        enabled_services: allowed,
      });
    }
  } catch (e) {
    // If the resolver function isn't installed yet, fall through silently —
    // that just means the database hasn't been migrated. Booking proceeds
    // as before.
    console.warn('[bookings] service-type resolver missing; skipping check:', e.message);
  }
}
// ─── End service-type validation ─────────────────────────────────────────────


/*
ALSO: update the dbType mapping a few lines below to support all 5 types.

Current code:
  const dbType = (serviceType || 'video').toUpperCase();

Replace with:
  const TYPE_MAP = {
    video: 'VIDEO', text: 'TEXT', chat: 'CHAT',
    phone: 'PHONE', inperson: 'INPERSON', document: 'DOCUMENT',
  };
  const dbType = TYPE_MAP[(serviceType || 'video').toLowerCase()] || 'VIDEO';
*/
