// Dashboard API — thin wrappers around Supabase calls.
// Auth state is managed by Supabase (supabase.auth), not localStorage tokens.

import { supabase } from '../lib/supabase';

// ── Auth ─────────────────────────────────────────────────────

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

// ── Trainer profile ──────────────────────────────────────────

export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('trainers')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(updates) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('trainers')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Event types ──────────────────────────────────────────────

export async function getEventTypes() {
  const { data: { user } } = await supabase.auth.getUser();
  const trainer = await getMyProfile();
  const { data, error } = await supabase
    .from('event_types')
    .select('*')
    .eq('tenant_id', trainer.tenant_id)
    .or(`trainer_id.is.null,trainer_id.eq.${user.id}`)
    .eq('is_active', true)
    .order('duration_minutes');
  if (error) throw error;
  return data;
}

export async function createEventType(payload) {
  const { data, error } = await supabase
    .from('event_types')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEventType(id, updates) {
  const { data, error } = await supabase
    .from('event_types')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Availability schedules ───────────────────────────────────

export async function getMySchedules() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('availability_schedules')
    .select('*')
    .eq('trainer_id', user.id)
    .eq('is_active', true)
    .order('day_of_week')
    .order('start_time');
  if (error) throw error;
  return data;
}

export async function upsertSchedule(schedule) {
  const { data, error } = await supabase
    .from('availability_schedules')
    .upsert(schedule, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSchedule(id) {
  const { error } = await supabase
    .from('availability_schedules')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Availability overrides ───────────────────────────────────

export async function getMyOverrides(from, to) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('availability_overrides')
    .select('*')
    .eq('trainer_id', user.id)
    .gte('date', from)
    .lte('date', to)
    .order('date');
  if (error) throw error;
  return data;
}

export async function upsertOverride(override) {
  const { data, error } = await supabase
    .from('availability_overrides')
    .upsert(override, { onConflict: 'trainer_id,date' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOverride(id) {
  const { error } = await supabase
    .from('availability_overrides')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Bookings ─────────────────────────────────────────────────

export async function getAvailableSlots(trainerId, eventTypeId, date) {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_trainer_id:    trainerId,
    p_event_type_id: eventTypeId,
    p_date:          date,
  });
  if (error) throw error;
  return data;
}

export async function getMyBookings({ from, to } = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  let query = supabase
    .from('bookings')
    .select(`
      id, status, notes, confirmed_at, starts_at, ends_at,
      trainer_id, event_type_id, tenant_id,
      trainers ( name ),
      event_types ( name, duration_minutes, color ),
      trainees ( id, display_name, picture_url, line_uid )
    `)
    .eq('trainer_id', user.id)
    .eq('status', 'confirmed')
    .order('starts_at');

  if (from) query = query.gte('starts_at', from);
  if (to)   query = query.lte('starts_at', to);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function cancelBooking(bookingId) {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'trainer' })
    .eq('id', bookingId);
  if (error) throw error;
}

export async function rescheduleBooking(bookingId, newStartsAt, newEndsAt) {
  const { data: original, error: fetchErr } = await supabase
    .from('bookings')
    .select('trainee_id, trainer_id, tenant_id, event_type_id')
    .eq('id', bookingId)
    .single();
  if (fetchErr) throw fetchErr;

  // Cancel old
  const { error: cancelErr } = await supabase
    .from('bookings')
    .update({ status: 'rescheduled', cancelled_by: 'trainer' })
    .eq('id', bookingId);
  if (cancelErr) throw cancelErr;

  // Create new
  const { data, error: insertErr } = await supabase
    .from('bookings')
    .insert({
      tenant_id:     original.tenant_id,
      trainer_id:    original.trainer_id,
      trainee_id:    original.trainee_id,
      event_type_id: original.event_type_id,
      starts_at:     newStartsAt,
      ends_at:       newEndsAt,
    })
    .select()
    .single();
  if (insertErr) throw insertErr;
  return data;
}
