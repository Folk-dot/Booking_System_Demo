-- ============================================================
-- Seed data for development
-- Trainer password: "password123" (bcrypt hash below)
-- ============================================================

-- Tenant
INSERT INTO tenants (id, name, slug, line_channel_id, line_channel_secret, line_channel_token)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'FitLife Gym',
  'fitlife-gym',
  'YOUR_LINE_CHANNEL_ID',
  'YOUR_LINE_CHANNEL_SECRET',
  'YOUR_LINE_CHANNEL_ACCESS_TOKEN'
);

-- Trainers (password: password123)
INSERT INTO trainers (id, tenant_id, email, password_hash, name, bio, specialty)
VALUES
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'som@fitlife.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Somchai Jaidee',
    'Personal trainer with 8 years experience in strength and conditioning.',
    'Strength Training'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'nok@fitlife.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Nok Wannee',
    'Certified yoga and pilates instructor. Specializes in flexibility and mindfulness.',
    'Yoga & Pilates'
  );

-- Availability slots (next 7 days, Asia/Bangkok = UTC+7)
-- Inserting as UTC (subtract 7h from Bangkok time)
INSERT INTO availability_slots (tenant_id, trainer_id, starts_at, ends_at)
SELECT
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  (NOW()::date + INTERVAL '1 day' + (h || ' hours')::interval) AT TIME ZONE 'Asia/Bangkok',
  (NOW()::date + INTERVAL '1 day' + (h || ' hours')::interval + INTERVAL '1 hour') AT TIME ZONE 'Asia/Bangkok'
FROM unnest(ARRAY[2, 3, 9, 10, 14, 15]) AS h;

INSERT INTO availability_slots (tenant_id, trainer_id, starts_at, ends_at)
SELECT
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002',
  (NOW()::date + INTERVAL '1 day' + (h || ' hours')::interval) AT TIME ZONE 'Asia/Bangkok',
  (NOW()::date + INTERVAL '1 day' + (h || ' hours')::interval + INTERVAL '1 hour') AT TIME ZONE 'Asia/Bangkok'
FROM unnest(ARRAY[1, 5, 8, 11, 13, 16]) AS h;
