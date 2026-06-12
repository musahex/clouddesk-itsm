import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `FATAL: ${name} environment variable is not set.\n` +
      `  Copy server/.env.example to server/.env and fill in the required values.`
    );
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';
const isDevelopment = !isProduction;

const rawPort = process.env.PORT ?? '5001';
const portNum = parseInt(rawPort, 10);
if (isNaN(portNum)) {
  throw new Error(`FATAL: PORT must be a valid number, got "${rawPort}".`);
}

const mongoUri = requireEnv('MONGO_URI');
const jwtSecret = requireEnv('JWT_SECRET');

if (isProduction && jwtSecret.length < 32) {
  throw new Error(
    'FATAL: JWT_SECRET must be at least 32 characters in production.\n' +
    '  Generate one with: openssl rand -hex 32'
  );
}

if (isProduction && !process.env.CLIENT_URL) {
  throw new Error(
    'FATAL: CLIENT_URL must be set in production.\n' +
    '  Set it to your deployed frontend URL (e.g. https://clouddesk.example.com).'
  );
}

const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';

// Sentry — optional, disabled by default
const sentryEnabled = process.env.SENTRY_ENABLED === 'true';
const sentryDsn = process.env.SENTRY_DSN || undefined;

if (sentryEnabled && !sentryDsn) {
  throw new Error(
    'FATAL: SENTRY_ENABLED is true but SENTRY_DSN is not set.\n' +
    '  Set SENTRY_DSN to your Sentry project DSN, or set SENTRY_ENABLED=false.'
  );
}

const sentryEnvironment = process.env.SENTRY_ENVIRONMENT ?? nodeEnv;
const sentryRelease = process.env.SENTRY_RELEASE ?? 'clouddesk-api@local';

// Redis — optional; enables distributed rate limiting for multi-instance deployments.
// When not set the app falls back to the in-memory rate-limit store (correct for single instance).
const redisUrl = process.env.REDIS_URL || undefined;

export const env = {
  port: portNum,
  mongoUri,
  jwtSecret,
  nodeEnv,
  clientUrl,
  isProduction,
  isDevelopment,
  sentryEnabled,
  sentryDsn,
  sentryEnvironment,
  sentryRelease,
  redisUrl,
} as const;
