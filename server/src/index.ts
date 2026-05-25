import './monitoring/sentry'; // must be first — Sentry init happens on module load
import { env } from './config/env';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import apiRoutes from './routes/index';
import User from './models/User';
import { logger, httpLogger, metricsMiddleware } from './monitoring/logger';
import { captureException } from './monitoring/sentry';

const app = express();

// Security headers
app.use(helmet());

// CORS — always allow localhost:5173; also allow CLIENT_URL if it differs (production)
const allowedOrigins = [...new Set(['http://localhost:5173', env.clientUrl])];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Structured request logging
app.use(httpLogger);

// In-memory metrics and safe event buffer — resets on server restart
app.use(metricsMiddleware);

// General rate limit — 200 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

// Stricter limit for auth endpoints — 20 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api', apiRoutes);

// 404 — unmatched /api routes
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler — returns JSON, never HTML
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, err.message);
  captureException(err);

  const status =
    (err as Error & { status?: number; statusCode?: number }).status ??
    (err as Error & { status?: number; statusCode?: number }).statusCode ??
    500;

  if (env.isDevelopment) {
    res.status(status).json({ message: err.message, stack: err.stack });
  } else {
    res.status(status).json({ message: 'Internal server error' });
  }
});

// Creates a weak-password default admin for local development only.
// Intentionally bypasses password validation — dev convenience account.
// Skipped entirely when NODE_ENV === 'production'.
async function bootstrapDevAdmin(): Promise<void> {
  if (env.isProduction) return;

  const email = 'admin@clouddesk.com';
  const existing = await User.findOne({ email });
  if (existing) return;

  const hashed = await bcrypt.hash('admin', 10);
  await User.create({ name: 'CloudDesk Admin', email, password: hashed, role: 'admin' });
  logger.warn('[DEV ONLY] Default admin created: admin@clouddesk.com / admin — never use these credentials in production');
}

async function start() {
  try {
    await mongoose.connect(env.mongoUri);
    logger.info('MongoDB connected');
    await bootstrapDevAdmin();
    const server = app.listen(env.port, () => {
      logger.info(`CloudDesk API running on http://localhost:${env.port}`);
    });

    function shutdown(signal: string): void {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => {
        mongoose.connection
          .close()
          .then(() => {
            logger.info('MongoDB connection closed');
            process.exit(0);
          })
          .catch(() => {
            process.exit(1);
          });
      });
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error({ err }, 'Server startup error');
    process.exit(1);
  }
}

start();
