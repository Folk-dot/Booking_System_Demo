-- ============================================================
-- Row Level Security Policies
-- Run this after schema.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE tenants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialists            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients                ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_types            ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings               ENABLE ROW LEVEL SECURITY;

-- ── Helper: get current user's tenant_id ────────────────────
-- Checks both specialists and clients tables
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM specialists WHERE id = auth.uid()
  UNION ALL
  SELECT tenant_id FROM clients WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ── Helper: is current user a specialist? ───────────────────
CREATE OR REPLACE FUNCTION is_specialist()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM specialists WHERE id = auth.uid() AND is_active = TRUE);
$$;

-- ── Helper: is current user a client? ───────────────────────
CREATE OR REPLACE FUNCTION is_client()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM clients WHERE id = auth.uid());
$$;

-- ── Tenants ──────────────────────────────────────────────────
-- Users can only read their own tenant
CREATE POLICY "users read own tenant"
  ON tenants FOR SELECT
  USING (id = get_my_tenant_id());

-- ── Specialists ──────────────────────────────────────────────
-- Anyone in the same tenant can see active specialists (clients need this to list specialists)
CREATE POLICY "tenant members read specialists"
  ON specialists FOR SELECT
  USING (tenant_id = get_my_tenant_id() AND is_active = TRUE);

-- Specialists can update only their own profile
CREATE POLICY "specialist updates own profile"
  ON specialists FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── Clients ──────────────────────────────────────────────────
-- Clients can only read their own row
CREATE POLICY "client reads own row"
  ON clients FOR SELECT
  USING (id = auth.uid());

-- Specialists can read clients in their tenant (to see who booked)
CREATE POLICY "specialist reads tenant clients"
  ON clients FOR SELECT
  USING (is_specialist() AND tenant_id = get_my_tenant_id());

-- Clients can update their own display info
CREATE POLICY "client updates own row"
  ON clients FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── Event Types ──────────────────────────────────────────────
-- Anyone in the tenant can read active event types
CREATE POLICY "tenant members read event types"
  ON event_types FOR SELECT
  USING (tenant_id = get_my_tenant_id() AND is_active = TRUE);

-- Specialists can create event types for their tenant (tenant-wide or own)
CREATE POLICY "specialist creates event types"
  ON event_types FOR INSERT
  WITH CHECK (
    is_specialist()
    AND tenant_id = get_my_tenant_id()
    AND (specialist_id IS NULL OR specialist_id = auth.uid())
  );

-- Specialists can update their own event types only
CREATE POLICY "specialist updates own event types"
  ON event_types FOR UPDATE
  USING (is_specialist() AND specialist_id = auth.uid())
  WITH CHECK (specialist_id = auth.uid());

-- ── Availability Schedules ───────────────────────────────────
-- Clients can read schedules to know when specialists are available
CREATE POLICY "tenant members read schedules"
  ON availability_schedules FOR SELECT
  USING (tenant_id = get_my_tenant_id());

-- Specialists manage only their own schedules
CREATE POLICY "specialist manages own schedules"
  ON availability_schedules FOR ALL
  USING (specialist_id = auth.uid())
  WITH CHECK (specialist_id = auth.uid());

-- ── Availability Overrides ───────────────────────────────────
CREATE POLICY "tenant members read overrides"
  ON availability_overrides FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "specialist manages own overrides"
  ON availability_overrides FOR ALL
  USING (specialist_id = auth.uid())
  WITH CHECK (specialist_id = auth.uid());

-- ── Bookings ─────────────────────────────────────────────────
-- Clients see only their own bookings
CREATE POLICY "client reads own bookings"
  ON bookings FOR SELECT
  USING (client_id = auth.uid());

-- Specialists see bookings assigned to them
CREATE POLICY "specialist reads own bookings"
  ON bookings FOR SELECT
  USING (specialist_id = auth.uid());

-- Clients can create bookings within their tenant
CREATE POLICY "client creates bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    is_client()
    AND client_id = auth.uid()
    AND tenant_id = get_my_tenant_id()
  );

-- Specialists can create bookings assigned to themselves (needed for reschedule flow)
CREATE POLICY "specialist creates bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    is_specialist()
    AND specialist_id = auth.uid()
    AND tenant_id = get_my_tenant_id()
  );

-- Clients can cancel their own confirmed bookings
CREATE POLICY "client cancels own bookings"
  ON bookings FOR UPDATE
  USING (client_id = auth.uid() AND status = 'confirmed')
  WITH CHECK (status = 'cancelled' AND cancelled_by = 'client');

-- Specialists can cancel or reschedule their own bookings
CREATE POLICY "specialist updates own bookings"
  ON bookings FOR UPDATE
  USING (specialist_id = auth.uid())
  WITH CHECK (specialist_id = auth.uid());
