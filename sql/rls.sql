-- ============================================================
-- Row Level Security Policies
-- Run this after schema.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE tenants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainees              ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_types           ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings              ENABLE ROW LEVEL SECURITY;

-- ── Helper: get current user's tenant_id ────────────────────
-- Checks both trainers and trainees tables
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM trainers WHERE id = auth.uid()
  UNION ALL
  SELECT tenant_id FROM trainees WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ── Helper: is current user a trainer? ──────────────────────
CREATE OR REPLACE FUNCTION is_trainer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM trainers WHERE id = auth.uid() AND is_active = TRUE);
$$;

-- ── Helper: is current user a trainee? ──────────────────────
CREATE OR REPLACE FUNCTION is_trainee()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM trainees WHERE id = auth.uid());
$$;

-- ── Tenants ──────────────────────────────────────────────────
-- Users can only read their own tenant
CREATE POLICY "users read own tenant"
  ON tenants FOR SELECT
  USING (id = get_my_tenant_id());

-- ── Trainers ─────────────────────────────────────────────────
-- Anyone in the same tenant can see active trainers (trainees need this to list trainers)
CREATE POLICY "tenant members read trainers"
  ON trainers FOR SELECT
  USING (tenant_id = get_my_tenant_id() AND is_active = TRUE);

-- Trainers can update only their own profile
CREATE POLICY "trainer updates own profile"
  ON trainers FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── Trainees ─────────────────────────────────────────────────
-- Trainees can only read their own row
CREATE POLICY "trainee reads own row"
  ON trainees FOR SELECT
  USING (id = auth.uid());

-- Trainers can read trainees in their tenant (to see who booked)
CREATE POLICY "trainer reads tenant trainees"
  ON trainees FOR SELECT
  USING (is_trainer() AND tenant_id = get_my_tenant_id());

-- Trainees can update their own display info
CREATE POLICY "trainee updates own row"
  ON trainees FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── Event Types ──────────────────────────────────────────────
-- Anyone in the tenant can read active event types
CREATE POLICY "tenant members read event types"
  ON event_types FOR SELECT
  USING (tenant_id = get_my_tenant_id() AND is_active = TRUE);

-- Trainers can create event types for their tenant (tenant-wide or own)
CREATE POLICY "trainer creates event types"
  ON event_types FOR INSERT
  WITH CHECK (
    is_trainer()
    AND tenant_id = get_my_tenant_id()
    AND (trainer_id IS NULL OR trainer_id = auth.uid())
  );

-- Trainers can update their own event types only
CREATE POLICY "trainer updates own event types"
  ON event_types FOR UPDATE
  USING (is_trainer() AND trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- ── Availability Schedules ───────────────────────────────────
-- Trainees can read schedules to know when trainers are available
CREATE POLICY "tenant members read schedules"
  ON availability_schedules FOR SELECT
  USING (tenant_id = get_my_tenant_id());

-- Trainers manage only their own schedules
CREATE POLICY "trainer manages own schedules"
  ON availability_schedules FOR ALL
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- ── Availability Overrides ───────────────────────────────────
CREATE POLICY "tenant members read overrides"
  ON availability_overrides FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "trainer manages own overrides"
  ON availability_overrides FOR ALL
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- ── Bookings ─────────────────────────────────────────────────
-- Trainees see only their own bookings
CREATE POLICY "trainee reads own bookings"
  ON bookings FOR SELECT
  USING (trainee_id = auth.uid());

-- Trainers see bookings assigned to them
CREATE POLICY "trainer reads own bookings"
  ON bookings FOR SELECT
  USING (trainer_id = auth.uid());

-- Trainees can create bookings within their tenant
CREATE POLICY "trainee creates bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    is_trainee()
    AND trainee_id = auth.uid()
    AND tenant_id = get_my_tenant_id()
  );

-- Trainees can cancel their own confirmed bookings
CREATE POLICY "trainee cancels own bookings"
  ON bookings FOR UPDATE
  USING (trainee_id = auth.uid() AND status = 'confirmed')
  WITH CHECK (status = 'cancelled' AND cancelled_by = 'trainee');

-- Trainers can cancel or reschedule their own bookings
CREATE POLICY "trainer updates own bookings"
  ON bookings FOR UPDATE
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());
