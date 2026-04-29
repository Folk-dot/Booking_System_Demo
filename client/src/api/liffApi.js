// LIFF API — Supabase calls for the trainee-facing app.
// Auth is handled via the /api/liff-auth Vercel function (LINE → Supabase session).

import { supabase } from '../lib/supabase';

// ── Trainee profile cache ─────────────────────────────────────
// Safe to cache for the lifetime of the session (one user per LIFF session).
let _traineeCache = null;

export async function getMyTraineeProfile() {
  if (_traineeCache) return _traineeCache;
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('trainees')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  _traineeCache = data;
  return data;
}

// ── Auth ─────────────────────────────────────────────────────

export async function liffSignIn(liffAccessToken) {
  const tenantId = import.meta.env.VITE_TENANT_ID;

  const res = await fetch('/api/liff-auth', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ liffAccessToken, tenantId }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'LIFF auth failed');
  }

  const { email, token } = await res.json();

  const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'magiclink' });
  if (error) throw error;

  // Clear cache so next call fetches fresh profile for this session
  _traineeCache = null;
  return data;
}

// ── Trainers ─────────────────────────────────────────────────

export async function listTrainers() {
  const trainee = await getMyTraineeProfile();
  const { data, error } = await supabase
    .from('trainers')
    .select('id, name, bio, avatar_url, specialty')
    .eq('tenant_id', trainee.tenant_id)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data;
}

export async function getTrainer(trainerId) {
  const { data, error } = await supabase
    .from('trainers')
    .select('id, name, bio, avatar_url, specialty')
    .eq('id', trainerId)
    .single();
  if (error) throw error;
  return data;
}

// ── Event types ──────────────────────────────────────────────

export async function getEventTypesForTrainer(trainerId) {
  const trainee = await getMyTraineeProfile();
  const { data, error } = await supabase
    .from('event_types')
    .select('id, name, description, duration_minutes, color')
    .eq('tenant_id', trainee.tenant_id)
    .or(`trainer_id.is.null,trainer_id.eq.${trainerId}`)
    .eq('is_active', true)
    .order('duration_minutes');
  if (error) throw error;
  return data;
}

// ── Availability ─────────────────────────────────────────────

export async function getTrainerSchedule(trainerId, from, to) {
  const { data, error } = await supabase.rpc('get_trainer_schedule', {
    p_trainer_id: trainerId,
    p_from:       from,
    p_to:         to,
  });
  if (error) throw error;
  return data;
}

export async function getAvailableSlots(trainerId, eventTypeId, date) {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_trainer_id:    trainerId,
    p_event_type_id: eventTypeId,
    p_date:          date,
  });
  if (error) throw error;
  return data;
}

// ── Bookings ─────────────────────────────────────────────────

export async function createBooking({ trainerId, eventTypeId, startsAt, endsAt, notes }) {
  const trainee = await getMyTraineeProfile();

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      tenant_id:     trainee.tenant_id,
      trainer_id:    trainerId,
      trainee_id:    trainee.id,
      event_type_id: eventTypeId,
      starts_at:     startsAt,
      ends_at:       endsAt,
      notes:         notes || null,
    })
    .select(`
      id, starts_at, ends_at, confirmed_at,
      trainers ( name ),
      event_types ( name, duration_minutes )
    `)
    .single();

  if (error) throw error;

  _notifyBookingConfirmed(data, trainee).catch(() => {});

  return data;
}

export async function getMyBookings() {
  const trainee = await getMyTraineeProfile();
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, status, notes, confirmed_at, starts_at, ends_at,
      trainers ( id, name, avatar_url ),
      event_types ( name, duration_minutes, color )
    `)
    .eq('trainee_id', trainee.id)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function cancelMyBooking(bookingId) {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'trainee' })
    .eq('id', bookingId);
  if (error) throw error;
}

// ── Internal ──────────────────────────────────────────────────

async function _notifyBookingConfirmed(booking, trainee) {
  if (!trainee.line_uid) return;
  const { data: { session } } = await supabase.auth.getSession();
  await fetch('/api/notify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({
      type:        'booking_confirmed',
      tenantId:    trainee.tenant_id,
      lineUid:     trainee.line_uid,
      trainerName: booking.trainers.name,
      startsAt:    booking.starts_at,
      endsAt:      booking.ends_at,
      bookingId:   booking.id,
    }),
  });
}
