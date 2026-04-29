-- ============================================================
-- Database Functions
-- Run this after schema.sql and rls.sql
-- ============================================================

-- ── get_available_slots ──────────────────────────────────────
-- Returns bookable time slots for a trainer+event_type on a given date.
-- Algorithm:
--   1. Get event type duration + buffers
--   2. Check for a date override (day off or custom hours)
--   3. Fall back to weekly schedule for that day_of_week
--   4. Generate slots across the availability window,
--      skipping any that overlap with confirmed bookings
--
-- Called from client via: supabase.rpc('get_available_slots', {...})
CREATE OR REPLACE FUNCTION get_available_slots(
  p_trainer_id    UUID,
  p_event_type_id UUID,
  p_date          DATE
)
RETURNS TABLE (slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_duration      INT;
  v_buf_before    INT;
  v_buf_after     INT;
  v_timezone      TEXT;
  v_day_of_week   INT;
  v_window_start  TIME;
  v_window_end    TIME;
  v_is_day_off    BOOLEAN;
  v_override      RECORD;
  v_schedule      RECORD;
  v_current       TIMESTAMPTZ;
  v_slot_end      TIMESTAMPTZ;
  v_win_start_ts  TIMESTAMPTZ;
  v_win_end_ts    TIMESTAMPTZ;
BEGIN
  -- Get event type details
  SELECT et.duration_minutes, et.buffer_before_minutes, et.buffer_after_minutes,
         t.timezone
  INTO v_duration, v_buf_before, v_buf_after, v_timezone
  FROM event_types et
  JOIN trainers tr ON tr.id = p_trainer_id
  JOIN tenants  t  ON t.id  = tr.tenant_id
  WHERE et.id = p_event_type_id AND et.is_active = TRUE;

  IF NOT FOUND THEN RETURN; END IF;

  -- Check for a date-specific override
  SELECT is_day_off, start_time, end_time
  INTO v_override
  FROM availability_overrides
  WHERE trainer_id = p_trainer_id AND date = p_date;

  IF FOUND THEN
    IF v_override.is_day_off THEN
      RETURN; -- whole day blocked
    END IF;
    v_window_start := v_override.start_time;
    v_window_end   := v_override.end_time;
  ELSE
    -- Use weekly recurring schedule
    v_day_of_week := EXTRACT(DOW FROM p_date)::INT; -- 0=Sun, 6=Sat

    -- Pick the first active window for this day (if trainer has split day, pick first)
    SELECT start_time, end_time
    INTO v_schedule
    FROM availability_schedules
    WHERE trainer_id = p_trainer_id
      AND day_of_week = v_day_of_week
      AND is_active = TRUE
    ORDER BY start_time
    LIMIT 1;

    IF NOT FOUND THEN RETURN; END IF; -- trainer not working this day

    v_window_start := v_schedule.start_time;
    v_window_end   := v_schedule.end_time;
  END IF;

  -- Convert TIME on the given DATE to TIMESTAMPTZ using the tenant timezone
  v_win_start_ts := (p_date::TEXT || ' ' || v_window_start::TEXT)::TIMESTAMP
                    AT TIME ZONE v_timezone;
  v_win_end_ts   := (p_date::TEXT || ' ' || v_window_end::TEXT)::TIMESTAMP
                    AT TIME ZONE v_timezone;

  -- Skip dates fully in the past
  IF v_win_end_ts <= NOW() THEN RETURN; END IF;

  -- For today, start from the next full hour if we are already past window start
  IF v_win_start_ts < NOW() THEN
    v_win_start_ts := date_trunc('hour', NOW()) + INTERVAL '1 hour';
    IF v_win_start_ts >= v_win_end_ts THEN RETURN; END IF;
  END IF;

  -- Walk through the window and yield free slots
  v_current := v_win_start_ts;

  WHILE v_current + (v_duration || ' minutes')::INTERVAL <= v_win_end_ts LOOP
    v_slot_end := v_current + (v_duration || ' minutes')::INTERVAL;

    -- A slot is free if no confirmed booking overlaps when buffers are considered
    IF NOT EXISTS (
      SELECT 1 FROM bookings
      WHERE trainer_id = p_trainer_id
        AND status     = 'confirmed'
        AND starts_at  < v_slot_end  + (v_buf_after  || ' minutes')::INTERVAL
        AND ends_at    > v_current   - (v_buf_before || ' minutes')::INTERVAL
    ) THEN
      slot_start := v_current;
      slot_end   := v_slot_end;
      RETURN NEXT;
    END IF;

    -- Step forward by duration + buffer_after
    v_current := v_current + ((v_duration + v_buf_after) || ' minutes')::INTERVAL;
  END LOOP;
END;
$$;

-- Grant execute to authenticated users (RLS on bookings still protects data)
GRANT EXECUTE ON FUNCTION get_available_slots TO authenticated;


-- ── get_trainer_schedule ─────────────────────────────────────
-- Returns a trainer's weekly schedule + any overrides for a date range.
-- Used by the LIFF calendar to mark which days have availability.
CREATE OR REPLACE FUNCTION get_trainer_schedule(
  p_trainer_id UUID,
  p_from        DATE,
  p_to          DATE
)
RETURNS TABLE (
  date         DATE,
  has_slots    BOOLEAN,
  is_day_off   BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_date       DATE;
  v_dow        INT;
  v_has_sched  BOOLEAN;
  v_override   RECORD;
BEGIN
  v_date := p_from;
  WHILE v_date <= p_to LOOP
    v_dow := EXTRACT(DOW FROM v_date)::INT;

    -- Check override first
    SELECT is_day_off, start_time
    INTO v_override
    FROM availability_overrides
    WHERE trainer_id = p_trainer_id AND date = v_date;

    IF FOUND THEN
      date       := v_date;
      is_day_off := v_override.is_day_off;
      has_slots  := NOT v_override.is_day_off;
      RETURN NEXT;
    ELSE
      -- Check weekly schedule
      SELECT EXISTS (
        SELECT 1 FROM availability_schedules
        WHERE trainer_id = p_trainer_id
          AND day_of_week = v_dow
          AND is_active = TRUE
      ) INTO v_has_sched;

      date       := v_date;
      is_day_off := FALSE;
      has_slots  := v_has_sched;
      RETURN NEXT;
    END IF;

    v_date := v_date + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION get_trainer_schedule TO authenticated;
