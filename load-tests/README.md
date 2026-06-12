# CloudDesk Load Testing

Safe, reproducible load testing baseline scripts for the CloudDesk API.

Default target is `http://localhost:5001` — the local Docker Compose stack. Run these tests locally before any scaling or deployment changes to capture a baseline.

---

## Dependency advisory note

Running `npm audit` will show 3 moderate severity vulnerabilities in the `uuid` package, which is a transitive dependency of `autocannon` via `hyperid`. The only available fix requires `npm audit fix --force`, which would downgrade autocannon from v8 to v2.0.1 — a breaking change that would break these scripts.

Do not run `npm audit fix --force`. The `uuid` vulnerability (missing buffer bounds check when the optional `buf` parameter is used) cannot be triggered by autocannon, hyperid, or these load testing scripts — none of them pass a custom buffer to uuid. The risk is zero in this context. These are dev-only load testing tools, completely isolated from the production server and client packages.

---

## Safety rules

- **Run against local Docker Compose first.** The scripts default to `http://localhost:5001`.
- **Do not run against production aggressively.** Production runs on a single EC2 instance behind CloudFront. If you ever point these scripts at production, use very low connections (1–2) and short durations (5–10s) to avoid impact.
- **`rate-limit-check.js` burns through the auth rate limit window.** Do not run it immediately before `authenticated-baseline.js` in the same 15-minute window, or the login in the authenticated test may be rate-limited. Run authenticated tests first.
- **No data mutation.** All test scripts use read-only endpoints. No tickets are created or modified.

---

## Setup

Install dependencies (isolated from the main server/client packages):

```bash
cd load-tests
npm install
```

---

## Start the local stack

From the **repo root**, start the API, MongoDB, and Redis containers:

```bash
docker compose up --build -d
```

Verify the API is ready:

```bash
curl http://localhost:5001/api/health/ready
# → {"status":"ready","database":"connected",...}
```

Seed demo users (required for authenticated tests — safe to re-run):

```bash
docker compose exec api npm run seed
```

---

## Run tests

From the `load-tests/` directory:

```bash
npm run health         # unauthenticated health endpoints
npm run authenticated  # authenticated read endpoints (dashboard, tickets, KB)
npm run rate-limit     # confirm auth rate limiting behaviour
```

---

## Examples with environment variables

**Health endpoints — custom connections and duration:**
```bash
BASE_URL=http://localhost:5001 CONNECTIONS=10 DURATION_SECONDS=20 npm run health
```

**Authenticated endpoints — custom user:**
```bash
BASE_URL=http://localhost:5001 \
  TEST_EMAIL=requester@clouddesk.dev \
  TEST_PASSWORD=Password123! \
  CONNECTIONS=5 \
  DURATION_SECONDS=20 \
  npm run authenticated
```

**Rate-limit check — custom attempt count:**
```bash
BASE_URL=http://localhost:5001 ATTEMPTS=25 npm run rate-limit
```

---

## Environment variables

| Variable | Default | Script |
|---|---|---|
| `BASE_URL` | `http://localhost:5001` | All |
| `DURATION_SECONDS` | `20` | health, authenticated |
| `CONNECTIONS` | `10` (health), `5` (authenticated) | health, authenticated |
| `TEST_EMAIL` | `requester@clouddesk.dev` | authenticated |
| `TEST_PASSWORD` | `Password123!` | authenticated |
| `ATTEMPTS` | `25` | rate-limit |

---

## What each script tests

### `health-baseline.js`

Tests the two unauthenticated health endpoints:
- `GET /api/health` — always-available service info
- `GET /api/health/ready` — MongoDB readiness check

These are the lowest-overhead endpoints. They represent the raw responsiveness of the API process before any auth or database query load.

### `authenticated-baseline.js`

Tests authenticated read endpoints. Logs in **once** at the start to get a JWT, then uses that token for all subsequent requests. This avoids repeatedly hitting the auth endpoint (which has a stricter rate limit of 20 req/15 min per IP).

Endpoints tested:
- `GET /api/dashboard` — aggregated ticket metrics
- `GET /api/tickets` — ticket list with Mongoose populate
- `GET /api/kb` — knowledge base article list

The JWT and password are never printed to the console.

### `rate-limit-check.js`

Sends sequential invalid login attempts using fake credentials that will never match a real user. Confirms that the auth rate limiter (20 req / 15 min per IP) produces HTTP 429 responses after the threshold is reached.

This is a functional check, not a throughput test. It runs one request at a time to clearly show the status progression.

---

## Metrics explained

| Metric | What it means |
|---|---|
| `Req/sec` | Average number of requests completed per second across the test window |
| `Avg latency` | Mean response time across all requests, in milliseconds |
| `p97.5 lat` | 97.5th percentile response time — 97.5% of requests completed faster than this |
| `p99 latency` | 99th percentile — only 1% of requests took longer than this |
| `Errors` | Network-level errors (connection refused, socket reset, etc.) |
| `Timeouts` | Requests that did not receive a response within the timeout window |
| `Non-2xx` | Responses with a non-2xx HTTP status code (4xx, 5xx) |

**Why p97.5 and not p95?**
autocannon uses HDR histogram percentile buckets that do not include exactly p95. The closest available bucket is p97.5. It is reported as `p97.5` in output rather than labeled as p95.

**What good results look like (local Docker Compose):**
- Health endpoints: 1000–5000+ req/sec, avg latency < 10 ms, 0 errors
- Authenticated endpoints: 50–500+ req/sec (depends on MongoDB query speed), 0 errors
- Rate-limit check: 401 for attempts 1–20, 429 from attempt 21 onwards (or earlier if tests run back-to-back in the same window)

---

## Recording results

Copy the printed summary into the results table in `docs/load-testing-baseline.md` after each run. The table format is:

```
| Date | Environment | Endpoint | Connections | Duration | Req/sec | Avg Latency | P97.5 | P99 | Errors | Notes |
```
