# Booking System — Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- LINE Developer account
- LIFF app created in LINE Developers Console

---

## 1. Clone & install

```bash
git clone <your-repo>
cd booking-system
npm install:all
```

---

## 2. PostgreSQL — create DB & run schema

```bash
createdb booking_db

psql booking_db < sql/schema.sql
psql booking_db < sql/seed.sql   # optional dev seed
```

---

## 3. Server environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
DATABASE_URL=postgresql://youruser:yourpassword@localhost:5432/booking_db
JWT_SECRET=<generate: openssl rand -hex 64>
JWT_REFRESH_SECRET=<generate: openssl rand -hex 64>
PORT=4000
TZ=Asia/Bangkok
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

For LINE (per-tenant values are stored in the DB, but you can set defaults here):
```env
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret
```

---

## 4. Client environment

```bash
cp client/.env.example client/.env.local
```

Edit `client/.env.local`:

```env
VITE_API_BASE=http://localhost:4000/v1
VITE_LIFF_ID=<your LIFF ID from LINE Developers>
VITE_TENANT_SLUG=fitlife-gym   # must match slug in tenants table
```

---

## 5. LINE setup

### Create a LINE Messaging API channel
1. Go to https://developers.line.biz
2. Create a provider → Create a Messaging API channel
3. Copy Channel ID, Channel Secret, Channel Access Token
4. Update the `tenants` row in DB with these values:

```sql
UPDATE tenants
SET
  line_channel_id     = 'YOUR_CHANNEL_ID',
  line_channel_secret = 'YOUR_CHANNEL_SECRET',
  line_channel_token  = 'YOUR_CHANNEL_ACCESS_TOKEN'
WHERE slug = 'fitlife-gym';
```

### Create a LIFF app
1. In the same channel → LIFF tab → Add
2. Size: Full
3. Endpoint URL: `https://yourdomain.com/liff` (or `https://localhost:5173` for dev with ngrok)
4. Scope: `profile openid`
5. Copy the LIFF ID → paste into `VITE_LIFF_ID`

### LINE Rich Menu (optional)
Create a rich menu in LINE Official Account Manager that opens your LIFF URL when tapped.

---

## 6. Run in development

```bash
# From root
npm run dev

# Or separately:
cd server && npm run dev          # API on :4000
cd client && npm run dev          # LIFF on :5173 (uses vite.liff.config.js)

# Dashboard on :5174
cd client && npx vite --config vite.dashboard.config.js
```

---

## 7. Build for production

```bash
cd client
npm run build:liff        # → dist/liff/
npm run build:dashboard   # → dist/dashboard/
```

Serve `dist/liff` at your LIFF endpoint URL (e.g. `/liff`).
Serve `dist/dashboard` at your dashboard URL (e.g. `/dashboard`).

### Nginx example
```nginx
server {
  listen 443 ssl;
  server_name yourdomain.com;

  location /liff {
    root /var/www/booking-system/dist;
    try_files $uri $uri/ /liff/index.html;
  }

  location /dashboard {
    root /var/www/booking-system/dist;
    try_files $uri $uri/ /dashboard/index.html;
  }

  location /v1 {
    proxy_pass http://localhost:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

---

## 8. Adding a new tenant (selling to another gym)

1. Insert a tenant row:
```sql
INSERT INTO tenants (name, slug, line_channel_id, line_channel_secret, line_channel_token)
VALUES ('Second Gym', 'second-gym', 'CHANNEL_ID', 'SECRET', 'TOKEN');
```

2. Insert trainers for that tenant.
3. Create a separate LIFF app pointing to the same frontend with `?tenant=second-gym` or a separate deployment with `VITE_TENANT_SLUG=second-gym`.

Everything else — bookings, slots, trainees — is isolated by `tenant_id`.

---

## 9. Trainer default credentials (seed data)

| Email | Password | Name |
|---|---|---|
| som@fitlife.com | password123 | Somchai Jaidee |
| nok@fitlife.com | password123 | Nok Wannee |

---

## Architecture summary

```
LINE Rich Menu
    │ (opens LIFF URL)
    ▼
LIFF App (React)
  • LIFF SDK login
  • Choose trainer → pick slot → confirm
  • Receives LINE push on confirmation
    │
    ▼ REST API (JWT)
Express Server :4000
  • LIFF token verify → trainee JWT
  • Trainer email/password → JWT
  • Booking with SELECT FOR UPDATE guard
  • LINE Messaging API push (async)
    │
    ▼
PostgreSQL
  • tenant_id on every table (multi-tenant)
  • Partial unique index prevents double booking at DB level
  • All times stored UTC, displayed Asia/Bangkok
```
