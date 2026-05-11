-- ============================================================
-- Seed data — Gym demo
-- Run after schema.sql, rls.sql, functions.sql
-- Specialists already created in Supabase Auth — inserting directly.
-- ============================================================

DO $$
DECLARE
  v_tenant_id  UUID := '44834cfa-41c6-44b4-bd42-4b3ab9562d3f';
  v_spec_1     UUID := 'ea68a15e-07ae-4c44-8c0e-acee26b08f15'; -- somchai@demo.gym
  v_spec_2     UUID := 'f7ed10b5-ce53-4333-b021-5e08068943ba'; -- nok@demo.gym
  v_spec_3     UUID := 'ef6649b1-930c-4291-9549-3faa02bebcf5'; -- ariya@gym.demo
BEGIN

-- ── Tenant ───────────────────────────────────────────────────
INSERT INTO tenants (id, name, slug, timezone, line_channel_token, line_channel_secret)
VALUES (
  v_tenant_id,
  'FitLife Gym',
  'fitlife-gym',
  'Asia/Bangkok',
  'YOUR_LINE_CHANNEL_ACCESS_TOKEN',
  'YOUR_LINE_CHANNEL_SECRET'
)
ON CONFLICT (id) DO NOTHING;

-- ── Specialists ──────────────────────────────────────────────
INSERT INTO specialists (id, tenant_id, email, name, bio, specialty, is_active)
VALUES
  (
    v_spec_1,
    v_tenant_id,
    'somchai@demo.gym',
    'Somchai Jaidee',
    '8 years of experience in strength training and powerlifting coaching.',
    'Strength & Conditioning',
    TRUE
  ),
  (
    v_spec_2,
    v_tenant_id,
    'nok@demo.gym',
    'Nok Wannee',
    'Certified yoga and pilates instructor. Focuses on flexibility and mindfulness.',
    'Yoga & Pilates',
    TRUE
  ),
  (
    v_spec_3,
    v_tenant_id,
    'ariya@gym.demo',
    'Ariya Thongdee',
    'Professional Muay Thai fighter and certified cardio conditioning coach.',
    'Muay Thai & Cardio',
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- ── Event Types ──────────────────────────────────────────────
INSERT INTO event_types (tenant_id, specialist_id, name, description, duration_minutes, color, is_active)
VALUES
  (
    v_tenant_id, NULL,
    'Personal Training Session',
    'One-on-one training tailored to your goals — strength, weight loss, or endurance.',
    60, '#3B82F6', TRUE
  ),
  (
    v_tenant_id, NULL,
    'Group Class',
    'High-energy group workout. Max 10 participants. Suitable for all fitness levels.',
    45, '#10B981', TRUE
  ),
  (
    v_tenant_id, NULL,
    'Fitness Assessment',
    'Full body assessment including body composition, strength, and mobility tests.',
    30, '#F59E0B', TRUE
  );

-- ── Availability Schedules ───────────────────────────────────
-- Somchai: Mon–Fri 06:00–12:00 and 16:00–20:00
INSERT INTO availability_schedules (specialist_id, tenant_id, day_of_week, start_time, end_time)
VALUES
  (v_spec_1, v_tenant_id, 1, '06:00', '12:00'),
  (v_spec_1, v_tenant_id, 2, '06:00', '12:00'),
  (v_spec_1, v_tenant_id, 3, '06:00', '12:00'),
  (v_spec_1, v_tenant_id, 4, '06:00', '12:00'),
  (v_spec_1, v_tenant_id, 5, '06:00', '12:00'),
  (v_spec_1, v_tenant_id, 1, '16:00', '20:00'),
  (v_spec_1, v_tenant_id, 2, '16:00', '20:00'),
  (v_spec_1, v_tenant_id, 3, '16:00', '20:00'),
  (v_spec_1, v_tenant_id, 4, '16:00', '20:00'),
  (v_spec_1, v_tenant_id, 5, '16:00', '20:00');

-- Nok: Mon/Wed/Fri 08:00–14:00, Sat/Sun 08:00–12:00
INSERT INTO availability_schedules (specialist_id, tenant_id, day_of_week, start_time, end_time)
VALUES
  (v_spec_2, v_tenant_id, 1, '08:00', '14:00'),
  (v_spec_2, v_tenant_id, 3, '08:00', '14:00'),
  (v_spec_2, v_tenant_id, 5, '08:00', '14:00'),
  (v_spec_2, v_tenant_id, 6, '08:00', '12:00'),
  (v_spec_2, v_tenant_id, 0, '08:00', '12:00');

-- Ariya: Tue/Thu/Sat 10:00–13:00 and 17:00–21:00
INSERT INTO availability_schedules (specialist_id, tenant_id, day_of_week, start_time, end_time)
VALUES
  (v_spec_3, v_tenant_id, 2, '10:00', '13:00'),
  (v_spec_3, v_tenant_id, 4, '10:00', '13:00'),
  (v_spec_3, v_tenant_id, 6, '10:00', '13:00'),
  (v_spec_3, v_tenant_id, 2, '17:00', '21:00'),
  (v_spec_3, v_tenant_id, 4, '17:00', '21:00'),
  (v_spec_3, v_tenant_id, 6, '17:00', '21:00');

END $$;


-- ============================================================
-- Seed data — Dental Clinic demo
-- Create 3 specialist accounts in Supabase Auth first, then
-- replace the placeholder UUIDs below with the real auth UUIDs.
-- ============================================================

DO $$
DECLARE
  v_tenant_id  UUID := gen_random_uuid();   -- replace or note this value after insert
  v_spec_1     UUID := 'REPLACE_WITH_AUTH_UUID'; -- Dr. Pranee Suwannarat (General Dentist)
  v_spec_2     UUID := 'REPLACE_WITH_AUTH_UUID'; -- Dr. Chaiwat Meesuk     (Orthodontist)
  v_spec_3     UUID := 'REPLACE_WITH_AUTH_UUID'; -- Dr. Sunee Nakorn       (Oral Surgeon)
BEGIN

-- ── Tenant ───────────────────────────────────────────────────
INSERT INTO tenants (id, name, slug, timezone, line_channel_token, line_channel_secret)
VALUES (
  v_tenant_id,
  'Bright Smile Dental Clinic',
  'bright-smile-dental',
  'Asia/Bangkok',
  'YOUR_LINE_CHANNEL_ACCESS_TOKEN',
  'YOUR_LINE_CHANNEL_SECRET'
);

-- ── Specialists ──────────────────────────────────────────────
INSERT INTO specialists (id, tenant_id, email, name, bio, specialty, is_active)
VALUES
  (
    v_spec_1,
    v_tenant_id,
    'pranee@brightsmile.demo',
    'Dr. Pranee Suwannarat',
    'General dentist with 12 years of experience in restorative and preventive dentistry.',
    'General Dentistry',
    TRUE
  ),
  (
    v_spec_2,
    v_tenant_id,
    'chaiwat@brightsmile.demo',
    'Dr. Chaiwat Meesuk',
    'Certified orthodontist specializing in braces and Invisalign treatments.',
    'Orthodontics',
    TRUE
  ),
  (
    v_spec_3,
    v_tenant_id,
    'sunee@brightsmile.demo',
    'Dr. Sunee Nakorn',
    'Oral and maxillofacial surgeon with expertise in extractions, implants, and jaw surgery.',
    'Oral Surgery',
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- ── Event Types ──────────────────────────────────────────────
INSERT INTO event_types (tenant_id, specialist_id, name, description, duration_minutes, color, is_active)
VALUES
  (
    v_tenant_id, NULL,
    'New Patient Examination',
    'Comprehensive dental exam including X-rays, cleaning assessment, and treatment plan.',
    60, '#3B82F6', TRUE
  ),
  (
    v_tenant_id, NULL,
    'Dental Cleaning',
    'Professional teeth cleaning and polishing. Recommended every 6 months.',
    30, '#10B981', TRUE
  ),
  (
    v_tenant_id, NULL,
    'Treatment Session',
    'Follow-up appointment for fillings, extractions, braces adjustment, or other procedures.',
    45, '#F59E0B', TRUE
  ),
  (
    v_tenant_id, NULL,
    'Teeth Whitening',
    'Professional in-chair whitening treatment for a brighter, whiter smile.',
    90, '#8B5CF6', TRUE
  ),
  (
    v_tenant_id, NULL,
    'Root Canal Treatment',
    'Removal of infected pulp tissue to save the tooth. May require multiple sessions.',
    90, '#EF4444', TRUE
  ),
  (
    v_tenant_id, NULL,
    'Orthodontic Consultation',
    'Assessment and treatment planning for braces, retainers, or Invisalign aligners.',
    45, '#EC4899', TRUE
  ),
  (
    v_tenant_id, NULL,
    'Wisdom Tooth Extraction',
    'Surgical or simple removal of impacted or problematic wisdom teeth.',
    60, '#F97316', TRUE
  ),
  (
    v_tenant_id, NULL,
    'Dental Implant Consultation',
    'Evaluation and planning for single or multiple tooth implant replacements.',
    45, '#14B8A6', TRUE
  ),
  (
    v_tenant_id, NULL,
    'Emergency Dental Visit',
    'Same-day care for acute toothache, broken tooth, lost filling, or dental trauma.',
    30, '#DC2626', TRUE
  );

-- ── Availability Schedules ───────────────────────────────────
-- Dr. Pranee: Mon–Fri 09:00–17:00
INSERT INTO availability_schedules (specialist_id, tenant_id, day_of_week, start_time, end_time)
VALUES
  (v_spec_1, v_tenant_id, 1, '09:00', '17:00'),
  (v_spec_1, v_tenant_id, 2, '09:00', '17:00'),
  (v_spec_1, v_tenant_id, 3, '09:00', '17:00'),
  (v_spec_1, v_tenant_id, 4, '09:00', '17:00'),
  (v_spec_1, v_tenant_id, 5, '09:00', '17:00');

-- Dr. Chaiwat: Mon/Wed/Fri 10:00–18:00, Sat 09:00–13:00
INSERT INTO availability_schedules (specialist_id, tenant_id, day_of_week, start_time, end_time)
VALUES
  (v_spec_2, v_tenant_id, 1, '10:00', '18:00'),
  (v_spec_2, v_tenant_id, 3, '10:00', '18:00'),
  (v_spec_2, v_tenant_id, 5, '10:00', '18:00'),
  (v_spec_2, v_tenant_id, 6, '09:00', '13:00');

-- Dr. Sunee: Tue/Thu 08:00–15:00, Sat 08:00–12:00
INSERT INTO availability_schedules (specialist_id, tenant_id, day_of_week, start_time, end_time)
VALUES
  (v_spec_3, v_tenant_id, 2, '08:00', '15:00'),
  (v_spec_3, v_tenant_id, 4, '08:00', '15:00'),
  (v_spec_3, v_tenant_id, 6, '08:00', '12:00');

END $$;
