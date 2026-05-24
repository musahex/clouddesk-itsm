import * as Sentry from '@sentry/node';
import { env } from '../config/env';

if (env.sentryEnabled && env.sentryDsn) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.sentryEnvironment,
    release: env.sentryRelease,
  });
}

export { Sentry };

export function captureException(error: unknown): void {
  if (!env.sentryEnabled) return;
  Sentry.captureException(error);
}
