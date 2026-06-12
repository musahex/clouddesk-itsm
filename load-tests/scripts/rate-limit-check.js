'use strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const ATTEMPTS = parseInt(process.env.ATTEMPTS || '25', 10);

// Fake credentials that will always produce 401 (non-existent user)
const FAKE_EMAIL = 'rate-limit-probe@invalid.example';
const FAKE_PASS = 'NotARealPassword1';

async function sendAttempt() {
  const url = `${BASE_URL}/api/auth/login`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: FAKE_EMAIL, password: FAKE_PASS }),
    });
    return res.status;
  } catch (err) {
    return `ERR(${err.message})`;
  }
}

async function main() {
  console.log('=== CloudDesk Auth Rate-Limit Check ===');
  console.log(`Target:   ${BASE_URL}/api/auth/login`);
  console.log(`Attempts: ${ATTEMPTS} (sequential)`);
  console.log('');
  console.log('Note: Uses fake credentials. Responses should be 401 until');
  console.log('      the rate limit window is exhausted, then 429.');
  console.log('      Auth limit: 20 requests per 15 minutes per IP.');
  console.log('');

  const statusLog = [];
  let firstRateLimit = null;

  for (let i = 1; i <= ATTEMPTS; i++) {
    const status = await sendAttempt();
    statusLog.push(status);
    if (status === 429 && firstRateLimit === null) {
      firstRateLimit = i;
    }
    const marker = status === 429 ? ' ← rate limited' : '';
    console.log(`  #${String(i).padStart(2)}  →  ${status}${marker}`);
  }

  console.log('');
  console.log('── Status summary ──');
  const counts = statusLog.reduce((acc, s) => {
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  for (const [status, count] of Object.entries(counts).sort()) {
    console.log(`  HTTP ${status}: ${count}`);
  }

  console.log('');
  if (firstRateLimit !== null) {
    console.log(`  PASS — Rate limit (429) first appeared at attempt #${firstRateLimit}.`);
    console.log('  Auth rate limiting is active and working correctly.');
  } else {
    console.log(`  WARNING — No 429 responses seen after ${ATTEMPTS} attempts.`);
    console.log('  Possible causes:');
    console.log('    - Rate limit window reset between test runs (wait 15 min and retry)');
    console.log('    - Rate limiting is disabled or misconfigured');
    console.log('    - ATTEMPTS is set below the limit threshold (default limit: 20)');
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
