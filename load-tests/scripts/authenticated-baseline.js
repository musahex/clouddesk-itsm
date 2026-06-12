'use strict';

const autocannon = require('autocannon');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const TEST_EMAIL = process.env.TEST_EMAIL || 'requester@clouddesk.dev';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Password123!';
const DURATION = parseInt(process.env.DURATION_SECONDS || '20', 10);
const CONNECTIONS = parseInt(process.env.CONNECTIONS || '5', 10);

const READ_ENDPOINTS = ['/api/dashboard', '/api/tickets', '/api/kb'];

async function login() {
  const url = `${BASE_URL}/api/auth/login`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
  } catch (err) {
    throw new Error(
      `Cannot connect to ${BASE_URL}. Is the server running?\n  (${err.message})`
    );
  }

  if (res.status === 401) {
    throw new Error(
      'Login failed (401 Unauthorized). Check TEST_EMAIL and TEST_PASSWORD env vars. ' +
      'Ensure seed users exist: docker compose exec api npm run seed'
    );
  }
  if (res.status === 429) {
    throw new Error(
      'Login rate-limited (429). Wait 15 minutes before retrying, ' +
      'or restart Docker Compose to reset the in-memory store.'
    );
  }
  if (!res.ok) {
    throw new Error(`Login failed with HTTP ${res.status}.`);
  }

  const data = await res.json();
  if (!data.token) {
    throw new Error('Login response did not include a token. Unexpected server response.');
  }
  return data.token;
}

function runAutocannon(opts) {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function printSummary(path, result) {
  const r = result.requests;
  const l = result.latency;
  const fmt1 = (n) => (typeof n === 'number' ? n.toFixed(1) : 'n/a');
  const fmt2 = (n) => (typeof n === 'number' ? n.toFixed(2) : 'n/a');
  const fmtInt = (n) => (typeof n === 'number' ? String(n) : 'n/a');

  console.log('');
  console.log(`  Endpoint:     GET ${path}`);
  console.log(`  Duration:     ${DURATION}s`);
  console.log(`  Connections:  ${CONNECTIONS}`);
  console.log(`  Req/sec:      ${fmt1(r.average)}`);
  console.log(`  Avg latency:  ${fmt2(l.average)} ms`);
  console.log(`  p97.5 lat:    ${fmtInt(l.p97_5)} ms`);
  console.log(`  p99 latency:  ${fmtInt(l.p99)} ms`);
  console.log(`  Total reqs:   ${r.total}`);
  console.log(`  Errors:       ${result.errors}`);
  console.log(`  Timeouts:     ${result.timeouts}`);
  console.log(`  Non-2xx:      ${result.non2xx}`);
}

async function main() {
  console.log('=== CloudDesk Authenticated Read Endpoint Baseline ===');
  console.log(`Target:      ${BASE_URL}`);
  console.log(`User:        ${TEST_EMAIL}`);
  console.log(`Duration:    ${DURATION}s per endpoint`);
  console.log(`Connections: ${CONNECTIONS}`);
  console.log('');
  console.log('Logging in (once) ...');

  const token = await login();
  console.log('Login successful. JWT obtained — token not printed.');

  const authHeaders = { Authorization: `Bearer ${token}` };

  for (const path of READ_ENDPOINTS) {
    const url = `${BASE_URL}${path}`;
    console.log(`\nRunning: GET ${url} ...`);
    const result = await runAutocannon({
      url,
      duration: DURATION,
      connections: CONNECTIONS,
      headers: authHeaders,
    });
    printSummary(path, result);
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
