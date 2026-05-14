import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import apiRoutes from './routes/index';
import User from './models/User';

dotenv.config();

// Fail fast — auth cannot function without a JWT secret
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Set it in .env and restart.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5001;

// Security headers
app.use(helmet());

// CORS — always allow localhost:5173 in dev; honour CLIENT_URL in production
const allowedOrigins = ['http://localhost:5173'];
if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}
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
  if (process.env.NODE_ENV === 'production') return;

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
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('MongoDB connected');
      await bootstrapDevAdmin();
    } else {
      console.warn('MONGO_URI not set — skipping database connection');
    }
    app.listen(PORT, () => {
      console.log(`CloudDesk API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}

start();
