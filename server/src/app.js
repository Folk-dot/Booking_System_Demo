import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import routes from './routes/routes.js';
import { timezoneMiddleware } from './middleware/timezone.js';

const app = express();
const PORT = process.env.PORT || 4000;

// ******************** need config later ***********************************
app.use(helmet());

// ******************** need config later if use cookies ********************
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
  })
);

// ******************** need config per ip **********************************
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

app.use('/v1', limiter);
app.use('/v1/auth', authLimiter);

app.use(express.json({ limit: '1mb' }));

app.use(timezoneMiddleware);

app.use('/v1', routes);

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', tz: process.env.TZ }));

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[server]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (TZ: ${process.env.TZ || 'Asia/Bangkok'})`);
});
