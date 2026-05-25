import React from 'react';
import ReactDOM from 'react-dom/client';
import { Sentry, sentryEnabled } from './monitoring/sentry';
import App from './App';
import AppErrorFallback from './components/AppErrorFallback';
import './index.css';

const wrappedApp = sentryEnabled ? (
  <Sentry.ErrorBoundary fallback={<AppErrorFallback />}>
    <App />
  </Sentry.ErrorBoundary>
) : (
  <App />
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{wrappedApp}</React.StrictMode>
);
