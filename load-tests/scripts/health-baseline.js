'use strict';

const autocannon = require('autocannon');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const DURATION = parseInt(process.env.DURATION_SECONDS || '20', 10);
const CONNECTIONS = parseInt(process.env.CONNECTIONS || '10', 10);

const ENDPOINTS = ['/api/health', '/api/health/ready'];

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
  console.log('=== CloudDesk Health Endpoint Baseline ===');
  console.log(`Target:      ${BASE_URL}`);
  console.log(`Duration:    ${DURATION}s per endpoint`);
  console.log(`Connections: ${CONNECTIONS}`);

  for (const path of ENDPOINTS) {
    const url = `${BASE_URL}${path}`;
    console.log(`\nRunning: GET ${url} ...`);
    const result = await runAutocannon({ url, duration: DURATION, connections: CONNECTIONS });
    printSummary(path, result);
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
