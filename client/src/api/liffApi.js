// LIFF API — Supabase calls for the client-facing app.
// Auth is handled via the /api/liff-auth Vercel function (LINE → Supabase session).

import { supabase } from '../lib/supabase';

// ── Client profile cache ──────────────────────────────────────
// Safe to cache for the lifetime of the session (one user per LIFF session).
let _clientCache = null;

export async function getMyClientProfile() {
  if (_clientCache) return _clientCache;
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  _clientCache = data;
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
  _clientCache = null;
  return data;
}

// ── Specialists ───────────────────────────────────────────────

export async function listSpecialists() {
  const { data, error } = await supabase
    .from('specialists')
    .select('id, name, bio, avatar_url, specialty')
    .eq('tenant_id', import.meta.env.VITE_TENANT_ID)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data;
}

export async function getSpecialist(specialistId) {
  const { data, error } = await supabase
    .from('specialists')
    .select('id, name, bio, avatar_url, specialty')
    .eq('id', specialistId)
    .single();
  if (error) throw error;
  return data;
}

// ── Event types ──────────────────────────────────────────────

export async function getEventTypesForSpecialist(specialistId) {
  const { data, error } = await supabase
    .from('event_types')
    .select('id, name, description, duration_minutes, color')
    .eq('tenant_id', import.meta.env.VITE_TENANT_ID)
    .or(`specialist_id.is.null,specialist_id.eq.${specialistId}`)
    .eq('is_active', true)
    .order('duration_minutes');
  if (error) throw error;
  return data;
}

// ── Availability ─────────────────────────────────────────────

export async function getSpecialistSchedule(specialistId, from, to) {
  const { data, error } = await supabase.rpc('get_specialist_schedule', {
    p_specialist_id: specialistId,
    p_from:          from,
    p_to:            to,
  });
  if (error) throw error;
  return data;
}

export async function getAvailableSlots(specialistId, eventTypeId, date) {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_specialist_id: specialistId,
    p_event_type_id: eventTypeId,
    p_date:          date,
  });
  if (error) throw error;
  return data;
}

// ── Bookings ─────────────────────────────────────────────────

export async function createBooking({ specialistId, eventTypeId, startsAt, endsAt, notes }) {
  const client = await getMyClientProfile();

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      tenant_id:     client.tenant_id,
      specialist_id: specialistId,
      client_id:     client.id,
      event_type_id: eventTypeId,
      starts_at:     startsAt,
      ends_at:       endsAt,
      notes:         notes || null,
    })
    .select(`
      id, starts_at, ends_at, confirmed_at,
      specialists ( name ),
      event_types ( name, duration_minutes )
    `)
    .single();

  if (error) throw error;

  _notifyBookingConfirmed(data, client).catch(() => {});

  return data;
}

export async function getMyBookings() {
  const client = await getMyClientProfile();
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, status, notes, confirmed_at, starts_at, ends_at,
      specialists ( id, name, avatar_url ),
      event_types ( name, duration_minutes, color )
    `)
    .eq('client_id', client.id)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function cancelMyBooking(bookingId) {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'client' })
    .eq('id', bookingId);
  if (error) throw error;
}

// ── Internal ──────────────────────────────────────────────────

async function _notifyBookingConfirmed(booking, client) {
  if (!client.line_uid) return;
  const { data: { session } } = await supabase.auth.getSession();
  await fetch('/api/notify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({
      type:           'booking_confirmed',
      tenantId:       client.tenant_id,
      lineUid:        client.line_uid,
      specialistName: booking.specialists.name,
      startsAt:       booking.starts_at,
      endsAt:         booking.ends_at,
      bookingId:      booking.id,
    }),
  });
}
