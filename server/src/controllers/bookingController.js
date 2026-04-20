import pool from '../config/db.js';
import { sendBookingConfirmation, sendCancellationNotice } from '../services/lineService.js';

// POST /bookings — trainee creates a booking
async function createBooking(req, res) {
  const { id: traineeId, lineUid, tenantId } = req.trainee;
  const { slotId, notes } = req.body;

  if (!slotId) {
    return res.status(400).json({ error: 'slotId required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the slot row — any concurrent request for same slot will queue here
    const { rows: slotRows } = await client.query(
      `SELECT s.id, s.trainer_id, s.starts_at, s.ends_at, s.is_blocked,
              s.tenant_id,
              t.name AS trainer_name
       FROM availability_slots s
       JOIN trainers t ON t.id = s.trainer_id
       WHERE s.id = $1 AND s.tenant_id = $2
       FOR UPDATE`,
      [slotId, tenantId]
    );

    if (slotRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Slot not found' });
    }

    const slot = slotRows[0];

    if (slot.is_blocked) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Slot is blocked' });
    }

    // Check for existing confirmed booking (belt-and-suspenders beyond partial unique index)
    const { rows: existing } = await client.query(
      `SELECT id FROM bookings WHERE slot_id = $1 AND status = 'confirmed'`,
      [slotId]
    );

    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Slot already booked' });
    }

    // Create booking
    const { rows: bookingRows } = await client.query(
      `INSERT INTO bookings (tenant_id, slot_id, trainer_id, trainee_id, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, confirmed_at`,
      [tenantId, slotId, slot.trainer_id, traineeId, notes || null]
    );

    const booking = bookingRows[0];
    await client.query('COMMIT');

    // Send LINE confirmation asynchronously (non-blocking)
    sendBookingConfirmation({
      tenantId,
      lineUid,
      trainerName: slot.trainer_name,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      bookingId: booking.id,
    });

    return res.status(201).json({
      id: booking.id,
      slotId,
      trainerId: slot.trainer_id,
      trainerName: slot.trainer_name,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      confirmedAt: booking.confirmed_at,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    // Unique index violation = concurrent double booking attempt
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slot already booked' });
    }
    console.error('[bookings/create]', err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

// GET /bookings/me — trainee's own bookings
async function getMyBookings(req, res) {
  const { id: traineeId, tenantId } = req.trainee;

  try {
    const { rows } = await pool.query(
      `SELECT
         b.id, b.status, b.notes, b.confirmed_at,
         s.starts_at AT TIME ZONE 'Asia/Bangkok' AS starts_at_bkk,
         s.ends_at   AT TIME ZONE 'Asia/Bangkok' AS ends_at_bkk,
         t.id AS trainer_id, t.name AS trainer_name, t.avatar_url
       FROM bookings b
       JOIN availability_slots s ON s.id = b.slot_id
       JOIN trainers t ON t.id = b.trainer_id
       WHERE b.trainee_id = $1 AND b.tenant_id = $2
       ORDER BY s.starts_at DESC`,
      [traineeId, tenantId]
    );

    return res.json(
      rows.map((r) => ({
        id: r.id,
        status: r.status,
        notes: r.notes,
        confirmedAt: r.confirmed_at,
        startsAt: r.starts_at_bkk,
        endsAt: r.ends_at_bkk,
        trainer: {
          id: r.trainer_id,
          name: r.trainer_name,
          avatarUrl: r.avatar_url,
        },
      }))
    );
  } catch (err) {
    console.error('[bookings/mine]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// GET /bookings/trainer — trainer's upcoming bookings
async function getTrainerBookings(req, res) {
  const { id: trainerId, tenantId } = req.trainer;

  try {
    const { rows } = await pool.query(
      `SELECT
         b.id, b.status, b.notes, b.confirmed_at,
         s.starts_at AT TIME ZONE 'Asia/Bangkok' AS starts_at_bkk,
         s.ends_at   AT TIME ZONE 'Asia/Bangkok' AS ends_at_bkk,
         tr.id AS trainee_id, tr.display_name, tr.picture_url, tr.line_uid
       FROM bookings b
       JOIN availability_slots s ON s.id = b.slot_id
       JOIN trainees tr ON tr.id = b.trainee_id
       WHERE b.trainer_id = $1 AND b.tenant_id = $2
         AND b.status = 'confirmed'
         AND s.starts_at >= NOW()
       ORDER BY s.starts_at`,
      [trainerId, tenantId]
    );

    return res.json(
      rows.map((r) => ({
        id: r.id,
        status: r.status,
        notes: r.notes,
        confirmedAt: r.confirmed_at,
        startsAt: r.starts_at_bkk,
        endsAt: r.ends_at_bkk,
        trainee: {
          id: r.trainee_id,
          name: r.display_name,
          pictureUrl: r.picture_url,
          lineUid: r.line_uid,
        },
      }))
    );
  } catch (err) {
    console.error('[bookings/trainer]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// PATCH /bookings/:id/cancel — trainer or trainee cancels
async function cancelBooking(req, res) {
  const { id: bookingId } = req.params;
  const user = req.user;
  const tenantId = user.tenantId;

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT b.id, b.trainer_id, b.trainee_id, b.status,
                s.starts_at, t.name AS trainer_name,
                tr.line_uid, tr.display_name
         FROM bookings b
         JOIN availability_slots s ON s.id = b.slot_id
         JOIN trainers t  ON t.id = b.trainer_id
         JOIN trainees tr ON tr.id = b.trainee_id
         WHERE b.id = $1 AND b.tenant_id = $2
         FOR UPDATE`,
        [bookingId, tenantId]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Booking not found' });
      }

      const booking = rows[0];

      // Authorisation: trainer can only cancel own bookings; trainee can only cancel own
      if (user.role === 'trainer' && booking.trainer_id !== user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Not your booking' });
      }
      if (user.role === 'trainee' && booking.trainee_id !== user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Not your booking' });
      }

      if (booking.status !== 'confirmed') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Booking is not in confirmed status' });
      }

      await client.query(
        `UPDATE bookings
         SET status = 'cancelled', cancelled_by = $1
         WHERE id = $2`,
        [user.role, bookingId]
      );

      await client.query('COMMIT');

      // Notify trainee via LINE if trainer cancelled
      if (user.role === 'trainer') {
        sendCancellationNotice({
          tenantId,
          lineUid: booking.line_uid,
          trainerName: booking.trainer_name,
          startsAt: booking.starts_at,
          cancelledBy: 'trainer',
        });
      }

      return res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[bookings/cancel]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// PATCH /bookings/:id/reschedule — trainer reschedules (cancel + new slot)
async function rescheduleBooking(req, res) {
  const { id: bookingId } = req.params;
  const { id: trainerId, tenantId } = req.trainer;
  const { newSlotId } = req.body;

  if (!newSlotId) {
    return res.status(400).json({ error: 'newSlotId required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate original booking
    const { rows: orig } = await client.query(
      `SELECT b.id, b.trainee_id, b.trainer_id, b.status,
              tr.line_uid, t.name AS trainer_name
       FROM bookings b
       JOIN trainees tr ON tr.id = b.trainee_id
       JOIN trainers t  ON t.id = b.trainer_id
       WHERE b.id = $1 AND b.tenant_id = $2 AND b.trainer_id = $3
       FOR UPDATE`,
      [bookingId, tenantId, trainerId]
    );

    if (orig.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found or not yours' });
    }

    if (orig[0].status !== 'confirmed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only confirmed bookings can be rescheduled' });
    }

    // Lock new slot
    const { rows: newSlot } = await client.query(
      `SELECT id, trainer_id, starts_at, ends_at, is_blocked
       FROM availability_slots
       WHERE id = $1 AND tenant_id = $2 AND trainer_id = $3
       FOR UPDATE`,
      [newSlotId, tenantId, trainerId]
    );

    if (newSlot.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'New slot not found' });
    }

    if (newSlot[0].is_blocked) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'New slot is blocked' });
    }

    const { rows: slotBooked } = await client.query(
      `SELECT id FROM bookings WHERE slot_id = $1 AND status = 'confirmed'`,
      [newSlotId]
    );

    if (slotBooked.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'New slot is already booked' });
    }

    // Cancel old booking
    await client.query(
      `UPDATE bookings SET status = 'rescheduled', cancelled_by = 'trainer' WHERE id = $1`,
      [bookingId]
    );

    // Create new booking
    const { rows: newBooking } = await client.query(
      `INSERT INTO bookings (tenant_id, slot_id, trainer_id, trainee_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, confirmed_at`,
      [tenantId, newSlotId, trainerId, orig[0].trainee_id]
    );

    await client.query('COMMIT');

    // Notify trainee
    sendBookingConfirmation({
      tenantId,
      lineUid: orig[0].line_uid,
      trainerName: orig[0].trainer_name,
      startsAt: newSlot[0].starts_at,
      endsAt: newSlot[0].ends_at,
      bookingId: newBooking[0].id,
    });

    return res.json({ newBookingId: newBooking[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'New slot already booked' });
    }
    console.error('[bookings/reschedule]', err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

export { createBooking, getMyBookings, getTrainerBookings, cancelBooking, rescheduleBooking };
