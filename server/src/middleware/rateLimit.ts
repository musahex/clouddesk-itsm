import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../monitoring/logger';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function buildLimiters() {
  if (env.redisUrl) {
    const client = new Redis(env.redisUrl);

    // Prevent unhandled Redis error events from crashing the process.
    // rate-limit-redis handles per-request failures gracefully (allows through on error).
    client.on('error', (err: Error) => {
      logger.error({ message: err.message, name: err.name }, 'Redis rate-limit client error');
    });

    const makeStore = (prefix: string) =>
      new RedisStore({
        sendCommand: (command: string, ...args: string[]) =>
          client.call(command, ...args) as Promise<RedisReply>,
        prefix,
      });

    logger.info('Rate limiting: Redis-backed store active — distributed, multi-instance safe');

    return {
      generalLimiter: rateLimit({
        windowMs: WINDOW_MS,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: 'Too many requests. Please try again later.' },
        store: makeStore('rl:general:'),
      }),
      authLimiter: rateLimit({
        windowMs: WINDOW_MS,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: 'Too many authentication attempts. Please try again later.' },
        store: makeStore('rl:auth:'),
      }),
    };
  }

  // REDIS_URL not set — fall back to the default in-memory store.
  // Acceptable for single-instance deployment; use REDIS_URL in multi-instance environments.
  logger.info(
    'Rate limiting: in-memory store (process-local) — set REDIS_URL for multi-instance deployments',
  );

  return {
    generalLimiter: rateLimit({
      windowMs: WINDOW_MS,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Too many requests. Please try again later.' },
    }),
    authLimiter: rateLimit({
      windowMs: WINDOW_MS,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Too many authentication attempts. Please try again later.' },
    }),
  };
}

export const { generalLimiter, authLimiter } = buildLimiters();
