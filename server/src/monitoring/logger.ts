import pino from 'pino';
import pinoHttp from 'pino-http';
import type { RequestHandler } from 'express';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['password', 'token', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
});

export const httpLogger = pinoHttp({
  logger,
  redact: {
    paths: ['req.headers.authorization', 'req.body.password', 'req.body.token'],
    censor: '[REDACTED]',
  },
}) as unknown as RequestHandler;
