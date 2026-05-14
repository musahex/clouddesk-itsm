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

export const env = {
  port: portNum,
  mongoUri,
  jwtSecret,
  nodeEnv,
  clientUrl,
  isProduction,
  isDevelopment,
} as const;
