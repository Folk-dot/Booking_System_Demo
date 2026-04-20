import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import pool from '../config/db.js';

// POST /auth/login — trainer email/password → JWT
async function login(req, res) {
  const { email, password, tenantSlug } = req.body;

  if (!email || !password || !tenantSlug) {
    return res.status(400).json({ error: 'email, password, tenantSlug required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT t.id AS trainer_id, t.password_hash, t.email, t.name, t.tenant_id
       FROM trainers t
       JOIN tenants ten ON ten.id = t.tenant_id
       WHERE t.email = $1 AND ten.slug = $2 AND t.is_active = TRUE`,
      [email.toLowerCase(), tenantSlug]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const trainer = rows[0];
    const valid = await bcrypt.compare(password, trainer.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = {
      id: trainer.trainer_id,
      email: trainer.email,
      name: trainer.name,
      tenantId: trainer.tenant_id,
      role: 'trainer',
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    return res.json({ token, trainer: payload });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// POST /auth/liff — verify LINE LIFF access token → trainee JWT
async function liffAuth(req, res) {
  const { liffAccessToken, tenantSlug } = req.body;

  if (!liffAccessToken || !tenantSlug) {
    return res.status(400).json({ error: 'liffAccessToken and tenantSlug required' });
  }

  try {
    // 1. Verify token with LINE
    const verifyRes = await axios.get('https://api.line.me/oauth2/v2.1/verify', {
      params: { access_token: liffAccessToken },
    });

    if (verifyRes.data.expires_in <= 0) {
      return res.status(401).json({ error: 'LIFF token expired' });
    }

    // 2. Get LINE profile
    const profileRes = await axios.get('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${liffAccessToken}` },
    });

    const { userId: lineUid, displayName, pictureUrl } = profileRes.data;

    // 3. Get tenant
    const tenantRes = await pool.query(
      'SELECT id FROM tenants WHERE slug = $1',
      [tenantSlug]
    );
    if (tenantRes.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const tenantId = tenantRes.rows[0].id;

    // 4. Upsert trainee
    const { rows } = await pool.query(
      `INSERT INTO trainees (tenant_id, line_uid, display_name, picture_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, line_uid) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             picture_url  = EXCLUDED.picture_url
       RETURNING id`,
      [tenantId, lineUid, displayName, pictureUrl || null]
    );

    const traineeId = rows[0].id;

    const payload = {
      id: traineeId,
      lineUid,
      displayName,
      tenantId,
      role: 'trainee',
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    return res.json({ token, trainee: payload });
  } catch (err) {
    if (err.response?.status === 400) {
      return res.status(401).json({ error: 'Invalid LIFF token' });
    }
    console.error('[auth/liff]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export { login, liffAuth };
