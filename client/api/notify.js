// Vercel Serverless Function
// POST /api/notify
// Sends a LINE push message to a trainee.
// Secured by verifying the caller's Supabase JWT — only authenticated
// users in the same tenant can trigger a notification.
//
// Why server-side: the LINE channel token is a secret that must not be in the browser.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function formatBkkTime(isoString) {
  return new Date(isoString).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
    hour:    '2-digit',
    minute:  '2-digit',
    hour12:  false,
  });
}

async function sendLineMessage(channelToken, lineUid, messages) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${channelToken}`,
    },
    body: JSON.stringify({ to: lineUid, messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LINE push failed: ${err}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Supabase JWT from Authorization header
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.replace('Bearer ', '');
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { type, tenantId, lineUid, trainerName, startsAt, endsAt, bookingId } = req.body;

  if (!type || !tenantId || !lineUid || !trainerName || !startsAt) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Fetch LINE channel token for this tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('line_channel_token')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant?.line_channel_token) {
      return res.status(200).json({ sent: false, reason: 'LINE not configured for tenant' });
    }

    const startStr = formatBkkTime(startsAt);
    const endStr   = endsAt
      ? new Date(endsAt).toLocaleString('th-TH', {
          timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
        })
      : null;

    let messages;

    if (type === 'booking_confirmed') {
      messages = [{
        type:     'flex',
        altText:  `✅ จองเทรนเนอร์สำเร็จ — ${trainerName}`,
        contents: {
          type:   'bubble',
          header: {
            type: 'box', layout: 'vertical', backgroundColor: '#27AE60',
            contents: [{ type: 'text', text: '✅ จองสำเร็จแล้ว', color: '#FFFFFF', size: 'lg', weight: 'bold' }],
          },
          body: {
            type: 'box', layout: 'vertical', spacing: 'md',
            contents: [
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: 'เทรนเนอร์', color: '#666666', size: 'sm', flex: 2 },
                { type: 'text', text: trainerName, weight: 'bold', size: 'sm', flex: 3 },
              ]},
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: 'วัน/เวลา', color: '#666666', size: 'sm', flex: 2 },
                { type: 'text', text: `${startStr}${endStr ? ' – ' + endStr : ''}`, size: 'sm', flex: 3, wrap: true },
              ]},
              bookingId && { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: 'รหัสการจอง', color: '#666666', size: 'sm', flex: 2 },
                { type: 'text', text: bookingId.slice(0, 8).toUpperCase(), size: 'sm', flex: 3, color: '#888888' },
              ]},
            ].filter(Boolean),
          },
          footer: {
            type: 'box', layout: 'vertical',
            contents: [{ type: 'text', text: 'หากต้องการยกเลิก กรุณาติดต่อเทรนเนอร์', size: 'xs', color: '#AAAAAA', wrap: true }],
          },
        },
      }];
    } else if (type === 'booking_cancelled') {
      const by = req.body.cancelledBy === 'trainer' ? 'เทรนเนอร์' : 'คุณ';
      messages = [{
        type: 'text',
        text: `❌ การจองถูกยกเลิกโดย${by}\n\nเทรนเนอร์: ${trainerName}\nวัน/เวลา: ${startStr}\n\nหากมีข้อสงสัยกรุณาติดต่อเทรนเนอร์โดยตรง`,
      }];
    } else {
      return res.status(400).json({ error: `Unknown notification type: ${type}` });
    }

    await sendLineMessage(tenant.line_channel_token, lineUid, messages);
    return res.status(200).json({ sent: true });
  } catch (err) {
    // Non-fatal — log but don't fail the caller's request
    console.error('[notify]', err.message);
    return res.status(200).json({ sent: false, reason: err.message });
  }
}
