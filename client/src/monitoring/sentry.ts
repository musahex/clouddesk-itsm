import * as Sentry from '@sentry/react';

const wantsEnabled = import.meta.env.VITE_SENTRY_ENABLED === 'true';
const dsn = import.meta.env.VITE_SENTRY_DSN || '';

let sentryEnabled = false;

if (wantsEnabled) {
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.warn(
        '[CloudDesk] VITE_SENTRY_ENABLED is true but VITE_SENTRY_DSN is not set. ' +
          'Sentry will not capture events.'
      );
    }
  } else {
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE || 'clouddesk-web@local',
      sendDefaultPii: false,
    });
    sentryEnabled = true;
  }
}

export { Sentry, sentryEnabled };

export function captureFrontendException(error: unknown): void {
  if (!sentryEnabled) return;
  Sentry.captureException(error);
}
