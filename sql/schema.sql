-- ============================================================
-- Booking System — PostgreSQL Schema
-- All timestamps stored as UTC (TIMESTAMPTZ)
-- Asia/Bangkok conversion handled at API layer
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tenants (gyms, clinics, tutor studios) ──────────────────
CREATE TABLE tenants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  line_channel_id     TEXT,
  line_channel_secret TEXT,
  line_channel_token  TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Trainers (email/password auth, belong to a tenant) ──────
CREATE TABLE trainers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  bio           TEXT,
  avatar_url    TEXT,
  specialty     TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(), 
  UNIQUE (tenant_id, email)
);

-- ── Trainees (identified by LINE user ID, per tenant) ───────
CREATE TABLE trainees (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  line_uid     TEXT NOT NULL,
  display_name TEXT,
  picture_url  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, line_uid)
);

-- ── Availability slots (trainer opens time windows) ─────────
CREATE TABLE availability_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trainer_id  UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  is_blocked  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

-- ── Bookings ────────────────────────────────────────────────
CREATE TABLE bookings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slot_id      UUID NOT NULL REFERENCES availability_slots(id),
  trainer_id   UUID NOT NULL REFERENCES trainers(id),
  trainee_id   UUID NOT NULL REFERENCES trainees(id),
  status       TEXT NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('confirmed', 'cancelled', 'rescheduled')),
  cancelled_by TEXT CHECK (cancelled_by IN ('trainer', 'trainee')),
  notes        TEXT,
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent double booking: only one confirmed booking per slot
CREATE UNIQUE INDEX idx_one_booking_per_slot
  ON bookings (slot_id)
  WHERE status = 'confirmed';

-- Performance indexes
CREATE INDEX idx_slots_trainer    ON availability_slots (trainer_id, starts_at);
CREATE INDEX idx_slots_tenant     ON availability_slots (tenant_id, starts_at);
CREATE INDEX idx_bookings_trainer ON bookings (trainer_id, status);
CREATE INDEX idx_bookings_trainee ON bookings (trainee_id);
CREATE INDEX idx_bookings_tenant  ON bookings (tenant_id, status);
