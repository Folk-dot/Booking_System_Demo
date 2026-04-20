import { createLineClient } from '../config/line.js';
import pool from '../config/db.js';

// Fetch tenant LINE credentials from DB
async function getTenantLineClient(tenantId) {
  const { rows } = await pool.query(
    'SELECT line_channel_token, line_channel_secret FROM tenants WHERE id = $1',
    [tenantId]
  );
  if (!rows[0]?.line_channel_token) return null;
  return createLineClient(rows[0].line_channel_token, rows[0].line_channel_secret);
}

// Format Bangkok time nicely
function formatBkkTime(isoString) {
  return new Date(isoString).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

async function sendBookingConfirmation({ tenantId, lineUid, trainerName, startsAt, endsAt, bookingId }) {
  try {
    const client = await getTenantLineClient(tenantId);
    if (!client) return; // LINE not configured for this tenant

    const startStr = formatBkkTime(startsAt);
    const endStr   = new Date(endsAt).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
    });

    await client.pushMessage({
      to: lineUid,
      messages: [
        {
          type: 'flex',
          altText: `✅ จองเทรนเนอร์สำเร็จ — ${trainerName}`,
          contents: {
            type: 'bubble',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#27AE60',
              contents: [
                {
                  type: 'text',
                  text: '✅ จองสำเร็จแล้ว',
                  color: '#FFFFFF',
                  size: 'lg',
                  weight: 'bold',
                },
              ],
            },
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'md',
              contents: [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: 'เทรนเนอร์', color: '#666666', size: 'sm', flex: 2 },
                    { type: 'text', text: trainerName, weight: 'bold', size: 'sm', flex: 3 },
                  ],
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: 'วัน/เวลา', color: '#666666', size: 'sm', flex: 2 },
                    { type: 'text', text: `${startStr} – ${endStr}`, size: 'sm', flex: 3, wrap: true },
                  ],
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: 'รหัสการจอง', color: '#666666', size: 'sm', flex: 2 },
                    { type: 'text', text: bookingId.slice(0, 8).toUpperCase(), size: 'sm', flex: 3, color: '#888888' },
                  ],
                },
              ],
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: 'หากต้องการยกเลิก กรุณาติดต่อเทรนเนอร์',
                  size: 'xs',
                  color: '#AAAAAA',
                  wrap: true,
                },
              ],
            },
          },
        },
      ],
    });
  } catch (err) {
    // Non-blocking: log and continue even if LINE push fails
    console.error('[LINE] sendBookingConfirmation failed:', err.message);
  }
}

async function sendCancellationNotice({ tenantId, lineUid, trainerName, startsAt, cancelledBy }) {
  try {
    const client = await getTenantLineClient(tenantId);
    if (!client) return;

    const startStr = formatBkkTime(startsAt);
    const by = cancelledBy === 'trainer' ? 'เทรนเนอร์' : 'คุณ';

    await client.pushMessage({
      to: lineUid,
      messages: [
        {
          type: 'text',
          text: `❌ การจองถูกยกเลิกโดย${by}\n\nเทรนเนอร์: ${trainerName}\nวัน/เวลา: ${startStr}\n\nหากมีข้อสงสัยกรุณาติดต่อเทรนเนอร์โดยตรง`,
        },
      ],
    });
  } catch (err) {
    console.error('[LINE] sendCancellationNotice failed:', err.message);
  }
}

export { sendBookingConfirmation, sendCancellationNotice };
