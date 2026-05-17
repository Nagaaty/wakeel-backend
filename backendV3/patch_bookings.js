const fs = require('fs');

const file = 'src/routes/bookings.js';
let content = fs.readFileSync(file, 'utf8');

// The clash check block
const targetStr = `  const { rows: [clash] } = await pool.query(
      \`SELECT id FROM bookings WHERE lawyer_id=$1 AND scheduled_at = $2::TIMESTAMP
       AND status NOT IN ('cancelled','rejected')\`,
      [lawyerId, scheduledAt]
    );
    if (clash) return res.status(409).json({ message: 'This time slot is already booked' });`;

const patchBlock = `
    // ─── Service-type validation ─────────────────────────────────────────────────
    {
      const requestedType = (serviceType || 'video').toLowerCase();
      const VALID = new Set(['video','text','phone','inperson','document','chat']);
      if (!VALID.has(requestedType)) {
        return res.status(400).json({ message: 'Invalid service type' });
      }
      const checkType = requestedType === 'chat' ? 'text' : requestedType;

      try {
        const { rows: [{ services }] } = await pool.query(
          \`SELECT resolve_lawyer_services($1, $2::date) AS services\`,
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
        console.warn('[bookings] service-type resolver missing; skipping check:', e.message);
      }
    }
    // ─── End service-type validation ─────────────────────────────────────────────`;

const idx = content.indexOf(targetStr);
if (idx !== -1) {
  content = content.substring(0, idx + targetStr.length) + "\n" + patchBlock + content.substring(idx + targetStr.length);
} else {
  console.log("Could not find targetStr for clash check in bookings.js");
}

// Replace dbType mapping
const oldDbType = `const dbType = (serviceType || 'video').toUpperCase();`;
const newDbType = `const TYPE_MAP = {
      video: 'VIDEO', text: 'TEXT', chat: 'CHAT',
      phone: 'PHONE', inperson: 'INPERSON', document: 'DOCUMENT',
    };
    const dbType = TYPE_MAP[(serviceType || 'video').toLowerCase()] || 'VIDEO';`;

const dbIdx = content.indexOf(oldDbType);
if (dbIdx !== -1) {
  content = content.substring(0, dbIdx) + newDbType + content.substring(dbIdx + oldDbType.length);
} else {
  console.log("Could not find dbType string");
}

fs.writeFileSync(file, content);
console.log('Bookings patches applied');
