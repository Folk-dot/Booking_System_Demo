-- ============================================================
-- Booking System — PostgreSQL Schema
-- All timestamps stored as UTC (TIMESTAMPTZ)
-- Specialist/client rows are linked to Supabase auth.users
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tenants ─────────────────────────────────────────────────
CREATE TABLE tenants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  timezone            TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  line_channel_token  TEXT,
  line_channel_secret TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Specialists ──────────────────────────────────────────────
-- id is the Supabase auth.users UUID — no separate password storage
CREATE TABLE specialists (
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

-- ── Clients ──────────────────────────────────────────────────
-- id is the Supabase auth.users UUID
-- LINE uid stored for push notifications — not used for auth
CREATE TABLE clients (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  line_uid     TEXT,
  display_name TEXT,
  picture_url  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, line_uid)
);

-- ── Event Types ──────────────────────────────────────────────
-- specialist_id NULL  → tenant-wide (applies to all specialists)
-- specialist_id SET   → specialist-specific override/addition
CREATE TABLE event_types (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  specialist_id         UUID REFERENCES specialists(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  duration_minutes      INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  buffer_before_minutes INT NOT NULL DEFAULT 0  CHECK (buffer_before_minutes >= 0),
  buffer_after_minutes  INT NOT NULL DEFAULT 0  CHECK (buffer_after_minutes >= 0),
  color                 TEXT DEFAULT '#3B82F6',
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Availability Schedules (weekly recurring) ────────────────
-- day_of_week: 0 = Sunday … 6 = Saturday
-- A specialist can have multiple windows on the same day (e.g. 9-12 and 14-17)
CREATE TABLE availability_schedules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id  UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week    SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time)
);

-- ── Availability Overrides (date-specific exceptions) ────────
-- is_day_off TRUE  → entire day blocked (start_time/end_time ignored)
-- is_day_off FALSE → custom hours for this date (overrides weekly schedule)
CREATE TABLE availability_overrides (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id  UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  is_day_off     BOOLEAN NOT NULL DEFAULT FALSE,
  start_time     TIME,
  end_time       TIME,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (specialist_id, date),
  CHECK (is_day_off = TRUE OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
);

-- ── Bookings ─────────────────────────────────────────────────
CREATE TABLE bookings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  specialist_id  UUID NOT NULL REFERENCES specialists(id),
  client_id      UUID NOT NULL REFERENCES clients(id),
  event_type_id  UUID NOT NULL REFERENCES event_types(id),
  starts_at      TIMESTAMPTZ NOT NULL,
  ends_at        TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('confirmed', 'cancelled', 'rescheduled')),
  cancelled_by   TEXT CHECK (cancelled_by IN ('specialist', 'client')),
  notes          TEXT,
  confirmed_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

-- Prevent double booking: no two confirmed bookings for same specialist overlap
CREATE UNIQUE INDEX idx_no_double_booking
  ON bookings (specialist_id, starts_at)
  WHERE status = 'confirmed';

-- Performance indexes
CREATE INDEX idx_bookings_specialist  ON bookings (specialist_id, status, starts_at);
CREATE INDEX idx_bookings_client      ON bookings (client_id, status);
CREATE INDEX idx_bookings_tenant      ON bookings (tenant_id, status);
CREATE INDEX idx_schedules_specialist ON availability_schedules (specialist_id, day_of_week);
CREATE INDEX idx_overrides_specialist ON availability_overrides (specialist_id, date);

-- ── Auth trigger: auto-create specialist/client row on sign-up ──
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data ->> 'role' = 'specialist' THEN
    INSERT INTO specialists (id, tenant_id, email, name)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data ->> 'tenant_id')::UUID,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email)
    )
    ON CONFLICT (id) DO NOTHING;

  ELSIF NEW.raw_user_meta_data ->> 'role' = 'client' THEN
    INSERT INTO clients (id, tenant_id, line_uid, display_name, picture_url)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data ->> 'tenant_id')::UUID,
      NEW.raw_user_meta_data ->> 'line_uid',
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'picture_url'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
