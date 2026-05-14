import { env } from './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import apiRoutes from './routes/index';
import User from './models/User';

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
  console.warn(
    '\x1b[33m[DEV ONLY]\x1b[0m Default admin created: admin@clouddesk.com / admin' +
    ' — never use these credentials in production'
  );
}

async function start() {
  try {
    await mongoose.connect(env.mongoUri);
    console.log('MongoDB connected');
    await bootstrapDevAdmin();
    app.listen(env.port, () => {
      console.log(`CloudDesk API running on http://localhost:${env.port}`);
    });
  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}

start();
