import pool from '../config/db.js';

// GET /slots?trainer_id=&date=YYYY-MM-DD
// Returns available (non-blocked, non-booked) slots in Asia/Bangkok
async function getAvailableSlots(req, res) {
  const tenantId = req.trainee?.tenantId || req.trainer?.tenantId;
  const { trainer_id, date } = req.query;

  if (!trainer_id || !date) {
    return res.status(400).json({ error: 'trainer_id and date required' });
  }

  // Parse date as Bangkok midnight → UTC range
  try {
    const { rows } = await pool.query(
      `SELECT
         s.id,
         s.trainer_id,
         s.starts_at AT TIME ZONE 'Asia/Bangkok' AS starts_at_bkk,
         s.ends_at   AT TIME ZONE 'Asia/Bangkok' AS ends_at_bkk,
         s.is_blocked,
         b.id IS NOT NULL AS is_booked
       FROM availability_slots s
       LEFT JOIN bookings b
         ON b.slot_id = s.id AND b.status = 'confirmed'
       WHERE s.tenant_id  = $1
         AND s.trainer_id = $2
         AND s.is_blocked = FALSE
         AND (s.starts_at AT TIME ZONE 'Asia/Bangkok')::date = $3::date
       ORDER BY s.starts_at`,
      [tenantId, trainer_id, date]
    );

    const slots = rows
      .filter((r) => !r.is_booked)
      .map((r) => ({
        id: r.id,
        trainerId: r.trainer_id,
        startsAt: r.starts_at_bkk,
        endsAt: r.ends_at_bkk,
      }));

    return res.json(slots);
  } catch (err) {
    console.error('[slots/list]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// GET /slots/trainer — trainer's own slots with booking status
async function getTrainerSlots(req, res) {
  const { id: trainerId, tenantId } = req.trainer;
  const { from, to } = req.query;

  try {
    const { rows } = await pool.query(
      `SELECT
         s.id,
         s.starts_at AT TIME ZONE 'Asia/Bangkok' AS starts_at_bkk,
         s.ends_at   AT TIME ZONE 'Asia/Bangkok' AS ends_at_bkk,
         s.is_blocked,
         b.id         AS booking_id,
         b.status     AS booking_status,
         tr.display_name AS trainee_name,
         tr.line_uid
       FROM availability_slots s
       LEFT JOIN bookings b   ON b.slot_id = s.id AND b.status = 'confirmed'
       LEFT JOIN trainees tr  ON tr.id = b.trainee_id
       WHERE s.trainer_id = $1
         AND s.tenant_id  = $2
         AND s.starts_at >= COALESCE($3::timestamptz, NOW())
         AND s.starts_at <= COALESCE($4::timestamptz, NOW() + INTERVAL '30 days')
       ORDER BY s.starts_at`,
      [trainerId, tenantId, from || null, to || null]
    );

    return res.json(
      rows.map((r) => ({
        id: r.id,
        startsAt: r.starts_at_bkk,
        endsAt: r.ends_at_bkk,
        isBlocked: r.is_blocked,
        booking: r.booking_id
          ? {
              id: r.booking_id,
              status: r.booking_status,
              trainee: { name: r.trainee_name, lineUid: r.line_uid },
            }
          : null,
      }))
    );
  } catch (err) {
    console.error('[slots/trainer]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// POST /slots — create one or more slots
async function createSlots(req, res) {
  const { id: trainerId, tenantId } = req.trainer;
  const { slots } = req.body; // [{ startsAt, endsAt }]

  if (!Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ error: 'slots array required' });
  }

  if (slots.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 slots per request' });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const created = [];
      for (const slot of slots) {
        if (!slot.startsAt || !slot.endsAt) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Each slot needs startsAt and endsAt' });
        }

        // Check for overlap with existing slots for this trainer
        const { rows: overlap } = await client.query(
          `SELECT id FROM availability_slots
           WHERE trainer_id = $1
             AND NOT (ends_at <= $2::timestamptz OR starts_at >= $3::timestamptz)`,
          [trainerId, slot.startsAt, slot.endsAt]
        );

        if (overlap.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: `Slot overlaps with existing slot`, slot });
        }

        const { rows } = await client.query(
          `INSERT INTO availability_slots (tenant_id, trainer_id, starts_at, ends_at)
           VALUES ($1, $2, $3::timestamptz, $4::timestamptz)
           RETURNING id,
             starts_at AT TIME ZONE 'Asia/Bangkok' AS starts_at_bkk,
             ends_at   AT TIME ZONE 'Asia/Bangkok' AS ends_at_bkk`,
          [tenantId, trainerId, slot.startsAt, slot.endsAt]
        );

        created.push({
          id: rows[0].id,
          startsAt: rows[0].starts_at_bkk,
          endsAt: rows[0].ends_at_bkk,
        });
      }

      await client.query('COMMIT');
      return res.status(201).json(created);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[slots/create]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// PATCH /slots/:id/block — trainer blocks a slot
async function blockSlot(req, res) {
  const { id: trainerId, tenantId } = req.trainer;
  const { id: slotId } = req.params;

  try {
    // Can't block if confirmed booking exists
    const { rows: bookings } = await pool.query(
      `SELECT id FROM bookings WHERE slot_id = $1 AND status = 'confirmed'`,
      [slotId]
    );

    if (bookings.length > 0) {
      return res.status(409).json({
        error: 'Cannot block a slot with a confirmed booking. Cancel the booking first.',
      });
    }

    const { rows } = await pool.query(
      `UPDATE availability_slots
       SET is_blocked = TRUE
       WHERE id = $1 AND trainer_id = $2 AND tenant_id = $3
       RETURNING id`,
      [slotId, trainerId, tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[slots/block]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// DELETE /slots/:id — delete slot
async function deleteSlot(req, res) {
  const { id: trainerId, tenantId } = req.trainer;
  const { id: slotId } = req.params;

  try {
    const { rows: bookings } = await pool.query(
      `SELECT id FROM bookings WHERE slot_id = $1 AND status = 'confirmed'`,
      [slotId]
    );

    if (bookings.length > 0) {
      return res.status(409).json({ error: 'Cannot delete a slot with a confirmed booking' });
    }

    const { rows } = await pool.query(
      `DELETE FROM availability_slots
       WHERE id = $1 AND trainer_id = $2 AND tenant_id = $3
       RETURNING id`,
      [slotId, trainerId, tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[slots/delete]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export { getAvailableSlots, getTrainerSlots, createSlots, blockSlot, deleteSlot };
