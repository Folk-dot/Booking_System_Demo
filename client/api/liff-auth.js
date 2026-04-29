// Vercel Serverless Function
// POST /api/liff-auth
// Verifies a LINE LIFF access token, then creates/signs-in the user in Supabase Auth.
// Returns a Supabase OTP token the client uses with supabase.auth.verifyOtp().
//
// Why server-side: the Supabase service-role key must never be in the browser.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { liffAccessToken, tenantId } = req.body;

  if (!liffAccessToken || !tenantId) {
    return res.status(400).json({ error: 'liffAccessToken and tenantId required' });
  }

  try {
    // 1. Verify token with LINE and get profile
    const [verifyRes, profileRes] = await Promise.all([
      fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${liffAccessToken}`),
      fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${liffAccessToken}` },
      }),
    ]);

    if (!verifyRes.ok) {
      return res.status(401).json({ error: 'Invalid LIFF token' });
    }

    const verify = await verifyRes.json();
    if (verify.expires_in <= 0) {
      return res.status(401).json({ error: 'LIFF token expired' });
    }

    const profile = await profileRes.json();
    const { userId: lineUid, displayName, pictureUrl } = profile;

    // 2. Synthetic email — deterministic, never shown to the user
    const email = `line_${lineUid}@liff.internal`;

    // 3. Create Supabase user if they don't exist yet
    //    The DB trigger (handle_new_user) will create the trainees row automatically.
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        role:         'trainee',
        tenant_id:    tenantId,
        line_uid:     lineUid,
        display_name: displayName,
        picture_url:  pictureUrl || null,
      },
    });

    // Ignore "user already exists" — that's fine
    if (createError && createError.message !== 'A user with this email address has already been registered') {
      console.error('[liff-auth] createUser error:', createError);
      return res.status(500).json({ error: 'Failed to create account' });
    }

    // 4. Generate a magic-link token so the client can get a real Supabase session
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type:  'magiclink',
      email,
    });

    if (linkError) {
      console.error('[liff-auth] generateLink error:', linkError);
      return res.status(500).json({ error: 'Failed to generate session token' });
    }

    // Return only what the client needs to call supabase.auth.verifyOtp()
    return res.status(200).json({
      email,
      token: linkData.properties.hashed_token,
    });
  } catch (err) {
    console.error('[liff-auth] unexpected error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
