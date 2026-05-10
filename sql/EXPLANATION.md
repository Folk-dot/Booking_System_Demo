# SQL Explanation — Booking System

This folder has three files that must be run in order:
1. schema.sql — creates all tables and the auth trigger
2. rls.sql — locks down who can see and touch what
3. functions.sql — the slot calculation engine

---

## schema.sql

### pgcrypto extension

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

Enables `gen_random_uuid()` which generates a UUID for every row's `id` column.
Without this, the default `gen_random_uuid()` calls in the tables below would fail.

---

### tenants

```sql
CREATE TABLE tenants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  timezone            TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  line_channel_token  TEXT,
  line_channel_secret TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

A tenant is one gym or studio. Every other table (trainers, trainees, bookings)
belongs to a tenant. This is what makes the system multi-tenant — multiple gyms
can run on the same database without seeing each other's data.

- `slug` — a short URL-friendly identifier like "hangar". Must be unique.
- `timezone` — used by the slot calculator to convert times correctly.
  Defaults to Bangkok since that is the target market.
- `line_channel_token` — optional. Only filled if the tenant wants LINE push
  notifications after bookings.

---

### trainers

```sql
CREATE TABLE trainers (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  name       TEXT NOT NULL,
  bio        TEXT,
  avatar_url TEXT,
  specialty  TEXT,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);
```

Key design decision: `id` is NOT auto-generated here. It references `auth.users(id)`
directly. This means the trainer's database row ID is the SAME UUID as their
Supabase Auth account. No separate mapping table needed.

`ON DELETE CASCADE` means: if the Supabase auth user is deleted, the trainer row
is deleted too. Same for tenant — delete the tenant, all trainers go with it.

`UNIQUE (tenant_id, email)` — the same email can exist in two different tenants
(two gyms), but not twice in the same gym.

---

### trainees

```sql
CREATE TABLE trainees (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  line_uid     TEXT,
  display_name TEXT,
  picture_url  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, line_uid)
);
```

Same pattern as trainers — `id` = Supabase auth user UUID.

`line_uid` is stored here NOT for authentication (auth is handled by Supabase)
but for sending LINE push notifications. When a booking is confirmed, the server
looks up the trainee's `line_uid` and pushes a message to that LINE account.

---

### event_types

```sql
CREATE TABLE event_types (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trainer_id            UUID REFERENCES trainers(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  duration_minutes      INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  buffer_before_minutes INT NOT NULL DEFAULT 0  CHECK (buffer_before_minutes >= 0),
  buffer_after_minutes  INT NOT NULL DEFAULT 0  CHECK (buffer_after_minutes >= 0),
  color                 TEXT DEFAULT '#3B82F6',
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
```

Event types define what can be booked — "1hr Personal Training", "30min Assessment", etc.

The `trainer_id` column is NULLABLE. This is the key to flexible event types:
- `trainer_id IS NULL` → tenant-wide event type. Applies to all trainers in the gym.
- `trainer_id IS SET` → trainer-specific. Only that trainer offers this event type.

`duration_minutes` is what the slot calculator uses to generate available time slots.
If this is 60, the calculator produces one-hour slots across the trainer's schedule.

`buffer_before_minutes` / `buffer_after_minutes` — padding around each booking.
For example, buffer_after = 15 means the trainer gets 15 minutes after each session
before the next slot becomes available. The slot calculator subtracts these buffers
when checking if a time window is free.

---

### availability_schedules

```sql
CREATE TABLE availability_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id   UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time)
);
```

This is the "weekly recurring schedule" — the Cal.com-style availability.
Instead of manually creating individual slots, a trainer sets their weekly pattern
once and it repeats automatically.

`day_of_week` uses PostgreSQL's convention: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.

A trainer can have MULTIPLE rows for the same day to handle split schedules.
For example, a trainer available 9am–12pm AND 2pm–5pm on Monday would have two rows
both with `day_of_week = 1`, one with 09:00–12:00 and one with 14:00–17:00.

`start_time` and `end_time` use PostgreSQL's TIME type — just a clock time with
no date attached. The slot calculator combines these with a specific date to get
actual timestamps.

The `CHECK (end_time > start_time)` constraint prevents accidentally saving
a window where the end is before the start.

---

### availability_overrides

```sql
CREATE TABLE availability_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  is_day_off  BOOLEAN NOT NULL DEFAULT FALSE,
  start_time  TIME,
  end_time    TIME,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trainer_id, date),
  CHECK (is_day_off = TRUE OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
);
```

Overrides handle exceptions to the weekly schedule — holidays, special hours, etc.
The slot calculator always checks this table FIRST before looking at the weekly schedule.

`is_day_off = TRUE` → entire day blocked, regardless of start_time/end_time.
`is_day_off = FALSE` → custom hours for this specific date, replacing the weekly window.

`UNIQUE (trainer_id, date)` — only one override per trainer per date. You can't have
two different overrides for the same day.

The CHECK constraint enforces a rule: if it's not a day off, you MUST provide
valid start_time and end_time (and end must be after start).

---

### bookings

```sql
CREATE TABLE bookings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trainer_id    UUID NOT NULL REFERENCES trainers(id),
  trainee_id    UUID NOT NULL REFERENCES trainees(id),
  event_type_id UUID NOT NULL REFERENCES event_types(id),
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed', 'cancelled', 'rescheduled')),
  cancelled_by  TEXT CHECK (cancelled_by IN ('trainer', 'trainee')),
  notes         TEXT,
  confirmed_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
```

Notice there is NO reference to a "slot" table. This is the Cal.com approach —
the actual booking stores `starts_at` and `ends_at` directly as timestamps.
Slots are calculated dynamically (see functions.sql), not stored.

`status` can only be one of three values — the CHECK constraint enforces this
at the database level, not just in application code.

`cancelled_by` tracks who cancelled — important for the notification logic
(if the trainer cancels, the trainee gets notified via LINE, and vice versa).

`trainer_id` references trainers but has NO `ON DELETE CASCADE`. This is
intentional — you should not be able to delete a trainer who has booking history.
The database will reject the deletion, forcing you to deactivate the trainer
instead (set `is_active = FALSE`).

---

### Indexes

```sql
CREATE UNIQUE INDEX idx_no_double_booking
  ON bookings (trainer_id, starts_at)
  WHERE status = 'confirmed';
```

This is a partial unique index — it only applies to confirmed bookings.
It prevents two confirmed bookings from having the exact same trainer + starts_at.
This is the last line of defence against double-booking race conditions.

Note: this only catches exact same start time. The slot calculator already
prevents overlapping slots from being offered to the user. This index is the
belt-and-suspenders safety net if two users somehow book simultaneously.

The other indexes (idx_bookings_trainer, idx_bookings_trainee, etc.) are
performance indexes — they make common queries faster by pre-sorting rows.

---

### Auth trigger

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data ->> 'role' = 'trainer' THEN
    INSERT INTO trainers (id, tenant_id, email, name) VALUES (...);
  ELSIF NEW.raw_user_meta_data ->> 'role' = 'trainee' THEN
    INSERT INTO trainees (id, tenant_id, line_uid, display_name, picture_url) VALUES (...);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

This trigger fires automatically every time a new user is created in Supabase Auth.
It reads the `user_metadata` that was attached when the user was created and
decides whether to create a trainer row or a trainee row.

`SECURITY DEFINER` means the function runs with the permissions of the function
owner (postgres superuser), not the user who triggered it. This is necessary
because the trigger needs to write to `trainers` and `trainees` even though
the inserting operation comes from the auth system.

`->>` is PostgreSQL's JSON text extraction operator. `raw_user_meta_data ->> 'role'`
reads the "role" key from the metadata JSON and returns it as text.

`ON CONFLICT (id) DO NOTHING` — if the trigger fires twice for some reason
(shouldn't happen, but defensive programming), it silently skips the second insert
instead of throwing an error.

---

## rls.sql

RLS = Row Level Security. Without it, any authenticated user could query any row
in the database. RLS adds rules that run invisibly on every query and filter
out rows the current user is not allowed to see.

### Enabling RLS

```sql
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
-- ... same for all other tables
```

Enabling RLS alone makes the table completely invisible to everyone except the
table owner (postgres). You must then create policies to allow access back in.

---

### Helper functions

Three small functions are defined to make the policies readable:

```sql
get_my_tenant_id() → UUID
```
Looks up the current user's tenant by checking both the trainers and trainees tables.
Called in almost every policy to scope data to the correct tenant.

```sql
is_trainer() → BOOLEAN
is_trainee() → BOOLEAN
```
Check whether the current user is a trainer or trainee. Used to restrict certain
operations (only trainers can create schedules, only trainees can create bookings).

`auth.uid()` is a Supabase built-in that returns the UUID of the currently
authenticated user. It reads from the JWT token in the request.

`SECURITY DEFINER` on these helpers means they run as the database owner,
which is necessary because they need to read from trainers/trainees tables
that are themselves protected by RLS — otherwise you'd get infinite recursion.

---

### Policy structure

Every policy has two parts:

`USING (condition)` — filters which existing rows the user can see or modify.
Applied to SELECT, UPDATE, DELETE.

`WITH CHECK (condition)` — validates what values the user can write.
Applied to INSERT, UPDATE.

Example:
```sql
CREATE POLICY "trainer updates own profile"
  ON trainers FOR UPDATE
  USING (id = auth.uid())        -- can only touch their own row
  WITH CHECK (id = auth.uid());  -- cannot change the id to someone else's
```

---

### Tenants

```sql
CREATE POLICY "users read own tenant"
  ON tenants FOR SELECT
  USING (id = get_my_tenant_id());
```

A user can only read their own tenant's row. They cannot see other gyms.

---

### Trainers

```sql
-- Trainees can see trainers in their tenant (to pick who to book)
CREATE POLICY "tenant members read trainers"
  ON trainers FOR SELECT
  USING (tenant_id = get_my_tenant_id() AND is_active = TRUE);

-- Trainers can only update their own row
CREATE POLICY "trainer updates own profile"
  ON trainers FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

Trainees need to list trainers so they can pick one to book. This policy allows it
while keeping trainers from other tenants invisible.

Only active trainers are visible — `is_active = TRUE` is enforced here.
A deactivated trainer disappears from the booking list automatically.

---

### Trainees

```sql
-- Trainees see only their own row
CREATE POLICY "trainee reads own row"
  ON trainees FOR SELECT
  USING (id = auth.uid());

-- Trainers can read trainees in their tenant (to see who booked them)
CREATE POLICY "trainer reads tenant trainees"
  ON trainees FOR SELECT
  USING (is_trainer() AND tenant_id = get_my_tenant_id());
```

Trainees cannot see each other. A trainee can only see their own profile row.
Trainers can see all trainees in their tenant so they know who is booking them.

---

### Event Types

```sql
-- Anyone in the tenant can read active event types
CREATE POLICY "tenant members read event types"
  ON event_types FOR SELECT
  USING (tenant_id = get_my_tenant_id() AND is_active = TRUE);

-- Trainers can create tenant-wide or their own event types
CREATE POLICY "trainer creates event types"
  ON event_types FOR INSERT
  WITH CHECK (
    is_trainer()
    AND tenant_id = get_my_tenant_id()
    AND (trainer_id IS NULL OR trainer_id = auth.uid())
  );
```

The INSERT policy allows a trainer to create:
- A tenant-wide event type (trainer_id IS NULL) — visible to all trainers
- Their own event type (trainer_id = their UUID)

But they cannot create an event type and assign it to a different trainer.

---

### Availability

```sql
-- Trainees can read schedules (to see which days have availability)
CREATE POLICY "tenant members read schedules"
  ON availability_schedules FOR SELECT
  USING (tenant_id = get_my_tenant_id());

-- Trainers manage only their own schedules
CREATE POLICY "trainer manages own schedules"
  ON availability_schedules FOR ALL
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());
```

`FOR ALL` covers SELECT, INSERT, UPDATE, DELETE in one policy.

Trainers can only read, create, update, and delete their own schedule rows.
They cannot touch another trainer's schedule.

Same pattern applies to availability_overrides.

---

### Bookings

```sql
-- Trainees see only their own bookings
CREATE POLICY "trainee reads own bookings"
  ON bookings FOR SELECT
  USING (trainee_id = auth.uid());

-- Trainers see bookings assigned to them
CREATE POLICY "trainer reads own bookings"
  ON bookings FOR SELECT
  USING (trainer_id = auth.uid());

-- Trainees can create bookings
CREATE POLICY "trainee creates bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    is_trainee()
    AND trainee_id = auth.uid()
    AND tenant_id = get_my_tenant_id()
  );

-- Trainees can only cancel (not reschedule, not change other fields)
CREATE POLICY "trainee cancels own bookings"
  ON bookings FOR UPDATE
  USING (trainee_id = auth.uid() AND status = 'confirmed')
  WITH CHECK (status = 'cancelled' AND cancelled_by = 'trainee');

-- Trainers can cancel or reschedule
CREATE POLICY "trainer updates own bookings"
  ON bookings FOR UPDATE
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());
```

The trainee cancel policy is the most specific one. The USING clause says
"only touch bookings that are yours AND currently confirmed". The WITH CHECK
says "the only allowed result is status='cancelled' with cancelled_by='trainee'".
This means a trainee cannot change any other field, cannot reschedule,
and cannot cancel an already-cancelled booking.

---

## functions.sql

### get_available_slots

This is the core of the Cal.com-style booking system. It is called from the
client via `supabase.rpc('get_available_slots', { ... })` and returns a list
of available time slots for a trainer on a given date.

```sql
CREATE OR REPLACE FUNCTION get_available_slots(
  p_trainer_id    UUID,
  p_event_type_id UUID,
  p_date          DATE
)
RETURNS TABLE (slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ)
```

It takes three inputs: which trainer, which event type (to know the duration),
and which date. It returns rows of (slot_start, slot_end) pairs.

**Step 1 — Get event type and timezone**

```sql
SELECT et.duration_minutes, et.buffer_before_minutes, et.buffer_after_minutes,
       t.timezone
INTO v_duration, v_buf_before, v_buf_after, v_timezone
FROM event_types et
JOIN trainers tr ON tr.id = p_trainer_id
JOIN tenants  t  ON t.id  = tr.tenant_id
WHERE et.id = p_event_type_id AND et.is_active = TRUE;

IF NOT FOUND THEN RETURN; END IF;
```

Gets the duration, buffers, and timezone in one query. If the event type
doesn't exist or is deactivated, returns nothing.

**Step 2 — Check for a date override**

```sql
SELECT is_day_off, start_time, end_time
INTO v_override
FROM availability_overrides
WHERE trainer_id = p_trainer_id AND date = p_date;

IF FOUND THEN
  IF v_override.is_day_off THEN
    RETURN; -- whole day blocked, no slots
  END IF;
  v_window_start := v_override.start_time;
  v_window_end   := v_override.end_time;
ELSE
  -- Fall back to weekly schedule
```

Overrides always win. If the trainer has marked this date as a day off, the
function immediately returns nothing. If they have custom hours for this date,
those hours are used instead of the weekly schedule.

**Step 3 — Fall back to weekly schedule**

```sql
v_day_of_week := EXTRACT(DOW FROM p_date)::INT; -- 0=Sunday

SELECT start_time, end_time
INTO v_schedule
FROM availability_schedules
WHERE trainer_id = p_trainer_id
  AND day_of_week = v_day_of_week
  AND is_active = TRUE
ORDER BY start_time
LIMIT 1;

IF NOT FOUND THEN RETURN; END IF;
```

If there is no override, look up the trainer's weekly schedule for this day.
`EXTRACT(DOW FROM date)` returns 0 for Sunday, which matches the day_of_week
column convention. If there is no schedule for this day, return nothing.

Note: currently only the first window is used (LIMIT 1). If a trainer has a
split schedule (morning + afternoon), only the morning window is used for slot
generation. This is a known limitation.

**Step 4 — Convert to timestamps**

```sql
v_win_start_ts := (p_date::TEXT || ' ' || v_window_start::TEXT)::TIMESTAMP
                  AT TIME ZONE v_timezone;
```

Takes the DATE (e.g., "2026-05-01") and the TIME (e.g., "09:00:00") and
combines them into a full TIMESTAMP, then converts to UTC using the tenant's
timezone. The database stores all timestamps in UTC, so this conversion is
necessary to get the right wall-clock time.

**Step 5 — Handle today's date**

```sql
IF v_win_end_ts <= NOW() THEN RETURN; END IF;

IF v_win_start_ts < NOW() THEN
  v_win_start_ts := date_trunc('hour', NOW()) + INTERVAL '1 hour';
END IF;
```

If the entire window is already in the past, return nothing.
If we are partway through the day (window already started), skip ahead to the next full hour so past times are never shown.

**Step 6 — Generate slots**

```sql
WHILE v_current + (v_duration || ' minutes')::INTERVAL <= v_win_end_ts LOOP
  v_slot_end := v_current + (v_duration || ' minutes')::INTERVAL;

  IF NOT EXISTS (
    SELECT 1 FROM bookings
    WHERE trainer_id = p_trainer_id
      AND status     = 'confirmed'
      AND starts_at  < v_slot_end  + (v_buf_after  || ' minutes')::INTERVAL
      AND ends_at    > v_current   - (v_buf_before || ' minutes')::INTERVAL
  ) THEN
    slot_start := v_current;
    slot_end   := v_slot_end;
    RETURN NEXT;  -- yield this slot as a result row
  END IF;

  v_current := v_current + ((v_duration + v_buf_after) || ' minutes')::INTERVAL;
END LOOP;
```

This loop walks through the availability window from start to end, stepping
forward by `duration + buffer_after` each time.

For each candidate slot, it checks if any confirmed booking overlaps with that
slot (including the buffer zones). The overlap condition checks both sides:
- A booking that starts before the slot ends (considering after-buffer)
- A booking that ends after the slot starts (considering before-buffer)

If no overlap is found, `RETURN NEXT` emits that slot as a result row.

`RETURN NEXT` in PostgreSQL means "yield this row and keep going" — it is how
set-returning functions work. The client receives all the yielded rows as a table.

---

### get_trainer_schedule

```sql
CREATE OR REPLACE FUNCTION get_trainer_schedule(
  p_trainer_id UUID,
  p_from        DATE,
  p_to          DATE
)
RETURNS TABLE (date DATE, has_slots BOOLEAN, is_day_off BOOLEAN)
```

A simpler function. Given a trainer and a date range, it returns one row per day
indicating whether that day has any availability. Used by the LIFF calendar to
highlight which dates the user can pick (no point showing a date picker if the
trainer is not available on most days).

It loops day by day from `p_from` to `p_to`:
1. Check if there is an override for that date → use it
2. Otherwise check if the weekly schedule covers that day of week

Returns `has_slots = TRUE` or `FALSE` for each date in the range.
This does NOT calculate actual slot times — that is done by `get_available_slots`
only after the user picks a specific date.

---

## Summary — how the three files work together

```
User picks a trainer and date
        ↓
get_trainer_schedule() → which days are green on the calendar
        ↓
User picks a date
        ↓
get_available_slots() → actual time slots for that day
        ↓
User picks a slot
        ↓
INSERT into bookings → RLS checks the user is allowed to insert
        ↓
Booking confirmed
```

The schema defines the data structure.
RLS defines who can touch it.
The functions define the business logic (slot calculation).
