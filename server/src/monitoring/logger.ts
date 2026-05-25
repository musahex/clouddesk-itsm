import pino from 'pino';
import pinoHttp from 'pino-http';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { recordRequest } from './metrics';
import { pushEvent } from './events';

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

// Records sanitized request metrics and pushes a safe event to the in-memory buffer.
// Runs on res 'finish' so the status code is final.
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const responseTimeMs = Date.now() - start;
    const method = req.method.toUpperCase();
    const path = req.path; // path only — no query string, no body, no headers
    const statusCode = res.statusCode;

    recordRequest(method, path, statusCode, responseTimeMs);

    const level: 'info' | 'warn' | 'error' =
      statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    pushEvent({
      timestamp: new Date().toISOString(),
      level,
      method,
      path,
      statusCode,
      responseTimeMs,
      message: `${method} ${path} ${statusCode} ${responseTimeMs}ms`,
    });
  });

  next();
}
