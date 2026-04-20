import bcrypt from 'bcrypt';
import pool from '../config/db.js';

// GET /trainers — list all active trainers for a tenant
async function listTrainers(req, res) {
  const tenantId = req.trainee?.tenantId || req.trainer?.tenantId;

  try {
    const { rows } = await pool.query(
      `SELECT id, name, bio, avatar_url, specialty
       FROM trainers
       WHERE tenant_id = $1 AND is_active = TRUE
       ORDER BY name`,
      [tenantId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[trainers/list]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// GET /trainers/:id — single trainer profile
async function getTrainer(req, res) {
  const tenantId = req.trainee?.tenantId || req.trainer?.tenantId;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id, name, bio, avatar_url, specialty
       FROM trainers
       WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE`,
      [id, tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Trainer not found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('[trainers/get]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// PUT /trainers/me — trainer updates own profile
async function updateProfile(req, res) {
  const { id: trainerId, tenantId } = req.trainer;
  const { name, bio, specialty, avatarUrl, currentPassword, newPassword } = req.body;

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // If changing password, verify current first
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'currentPassword required to set a new password' });
        }
        const { rows } = await client.query(
          'SELECT password_hash FROM trainers WHERE id = $1 AND tenant_id = $2',
          [trainerId, tenantId]
        );
        const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!valid) {
          await client.query('ROLLBACK');
          return res.status(401).json({ error: 'Current password incorrect' });
        }
        const hash = await bcrypt.hash(newPassword, 10);
        await client.query(
          'UPDATE trainers SET password_hash = $1 WHERE id = $2 AND tenant_id = $3',
          [hash, trainerId, tenantId]
        );
      }

      const { rows } = await client.query(
        `UPDATE trainers
         SET name       = COALESCE($1, name),
             bio        = COALESCE($2, bio),
             specialty  = COALESCE($3, specialty),
             avatar_url = COALESCE($4, avatar_url)
         WHERE id = $5 AND tenant_id = $6
         RETURNING id, name, bio, specialty, avatar_url`,
        [name, bio, specialty, avatarUrl, trainerId, tenantId]
      );

      await client.query('COMMIT');
      return res.json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[trainers/update]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export { listTrainers, getTrainer, updateProfile };
