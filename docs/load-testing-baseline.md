# CloudDesk Load Testing Baseline

## Purpose

This document establishes a measured performance baseline for the CloudDesk API on a single-instance Docker Compose deployment. The baseline provides a reference point before any future scaling changes — ECS/Fargate migration, ALB introduction, Redis/ElastiCache, or MongoDB Atlas tier changes.

Without a pre-change baseline, it is impossible to know whether a deployment change improved, degraded, or had no effect on API performance. This document captures the initial measurement.

---

## Test Environment

### Local baseline (primary)

| Component | Detail |
|---|---|
| Runtime | Docker Compose on local development machine |
| API | Node.js 20 Express, port 5001, `NODE_ENV=development` |
| Database | MongoDB 7 container (`clouddesk-mongo`) |
| Rate limiting | Redis 7 container (`clouddesk-redis`) — Redis-backed store |
| Load generator | autocannon running on the same machine as the API |
| Network | Loopback (`localhost`) — no network latency |

**Note:** A same-machine loopback baseline is not equivalent to production load. The numbers reflect raw API responsiveness without network overhead. Real-world production latency will be higher due to WAN latency, CloudFront, EC2 network stack, and MongoDB Atlas connection round-trips.

### Optional production smoke test

If ever testing against the live EC2 deployment, observe these constraints:
- Maximum 1–2 concurrent connections
- Maximum 5–10 second duration
- Health endpoints only unless specifically investigating a production issue
- Avoid `/api/auth/login` load on production (auth rate limit is 20 req/15 min)
- Watch EC2 CPU/memory before and after (available via EC2 console or CloudWatch)
- The production API is a portfolio deployment — aggressive testing can cause real downtime

---

## Test Scenarios

### 1. Health endpoint baseline (`npm run health`)

Tests `GET /api/health` and `GET /api/health/ready` with no authentication.

**Purpose:** Establish the floor — the fastest the API can respond with a minimal workload. Health endpoints do a MongoDB ping (for `/ready`) and return a small JSON payload. Any future regression against this baseline indicates an infrastructure or runtime issue unrelated to business logic.

**Default settings:** 10 connections, 20 seconds per endpoint.

### 2. Authenticated read endpoint baseline (`npm run authenticated`)

Tests `GET /api/dashboard`, `GET /api/tickets`, and `GET /api/kb` with a single JWT shared across all connections.

**Purpose:** Measure realistic API throughput under authenticated read load. These endpoints involve Mongoose queries with populate and aggregation. Performance is bounded by MongoDB query latency, connection pool size, and Express serialisation.

**Key design decision:** The script logs in **once** at the start and reuses the JWT for all concurrent connections. This avoids stressing the auth endpoint (rate limit: 20 req / 15 min) and isolates the measurement to the read endpoints.

**Default settings:** 5 connections, 20 seconds per endpoint.

### 3. Rate-limit behaviour check (`npm run rate-limit`)

Sends 25 sequential invalid login attempts using fake credentials.

**Purpose:** Confirm that the auth rate limiter (20 req / 15 min per IP) is active and returns HTTP 429 after the threshold. This is a functional check, not a throughput benchmark.

---

## How to Run

See `load-tests/README.md` for the full setup and usage guide.

**Quick reference:**

```bash
# 1. Install load test dependencies
cd load-tests && npm install

# 2. Start the local stack (from repo root)
docker compose up --build -d

# 3. Seed demo users
docker compose exec api npm run seed

# 4. Run tests (from load-tests/)
npm run health
npm run authenticated
npm run rate-limit
```

**Custom parameters:**

```bash
BASE_URL=http://localhost:5001 CONNECTIONS=10 DURATION_SECONDS=30 npm run health

BASE_URL=http://localhost:5001 TEST_EMAIL=requester@clouddesk.dev TEST_PASSWORD=Password123! npm run authenticated

ATTEMPTS=25 npm run rate-limit
```

---

## Results Template

Copy this table into the results section below after each test run. Record one row per endpoint per run.

| Date | Environment | Endpoint | Connections | Duration (s) | Req/sec | Avg latency (ms) | P97.5 (ms) | P99 (ms) | Errors | Notes |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---|
| | | | | | | | | | | |

---

## Initial Baseline Results

_Run date: 2026-06-13_

_Environment: Local Docker Compose — macOS, localhost loopback_

### Health endpoints (10 connections, 20s)

| Date | Environment | Endpoint | Connections | Duration (s) | Req/sec | Avg latency (ms) | P97.5 (ms) | P99 (ms) | Errors | Notes |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---|
| 2026-06-13 | Local Docker Compose | GET /api/health | 10 | 20 | 9,879.9 | 0.28 | 1 | 2 | 0 | Same-machine loopback |
| 2026-06-13 | Local Docker Compose | GET /api/health/ready | 10 | 20 | 9,510.5 | 0.40 | 1 | 2 | 0 | Includes MongoDB ping |

### Authenticated read endpoints (5 connections, 20s)

| Date | Environment | Endpoint | Connections | Duration (s) | Req/sec | Avg latency (ms) | P97.5 (ms) | P99 (ms) | Errors | Notes |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---|
| 2026-06-13 | Local Docker Compose | GET /api/dashboard | 5 | 20 | 1,237.5 | 3.48 | 5 | 8 | 0 | Aggregation query |
| 2026-06-13 | Local Docker Compose | GET /api/tickets | 5 | 20 | 2,367.8 | 1.67 | 2 | 3 | 0 | List with populate |
| 2026-06-13 | Local Docker Compose | GET /api/kb | 5 | 20 | 2,374.6 | 1.68 | 2 | 3 | 0 | List with populate |

### Rate-limit check (25 sequential attempts)

| Date | Environment | Result | First 429 at attempt | Notes |
|---|---|---|---|---|
| 2026-06-13 | Local Docker Compose | PASS | #20 | 1 auth slot consumed by prior login; 429 at cumulative request #21 |

**Observations from initial run:**

- Health endpoints handle ~9,500–9,900 req/sec at p97.5 ≤ 1ms, p99 ≤ 2ms. This reflects raw Express responsiveness for near-zero-work endpoints.
- Dashboard throughput (1,237.5 req/sec) is ~7.5× slower than ticket list (2,367.8 req/sec). The dashboard runs an aggregation pipeline; tickets and KB use standard find/populate queries.
- Tickets and KB show identical characteristics (same query pattern, same data volume). Both hold p99 ≤ 3ms.
- Zero errors or timeouts across all endpoints and all request counts. The baseline is valid.
- Rate-limit PASS confirmed. Auth rate limiter (20 req/15 min) correctly blocked requests after the threshold. The first 429 appeared at probe attempt #20 rather than #21 because one auth slot was already consumed by the login in `authenticated-baseline`.

**Note on rate limit configuration:** The local Docker Compose stack sets `RATE_LIMIT_MAX_GENERAL=1000000` so that the general rate limiter does not interfere with throughput measurements. The auth limiter remains at the default 20 req/15 min and is tested explicitly by `npm run rate-limit`. Production `docker-compose.prod.yml` is unchanged (defaults: 200 general, 20 auth).

---

## Metrics Interpretation

**Req/sec** measures throughput — how many requests the API can complete per second under the test concurrency. Higher is better. Health endpoints should be significantly faster than authenticated read endpoints because they do less work (a ping vs. a MongoDB aggregation).

**Average latency** is the mean response time across all requests. It is useful for a quick read but can be skewed by outliers. For SLA thinking, the p97.5 and p99 percentiles matter more.

**p97.5 latency** means 97.5% of requests returned faster than this value. autocannon uses HDR histogram buckets that do not include exactly p95; p97.5 is the nearest available bucket and is used as the p95 approximation.

**p99 latency** means 99 out of 100 requests returned faster than this. Spikes here indicate occasional database slow queries, GC pauses, or resource contention. For a local loopback test, p99 should stay well under 100 ms.

**Errors and timeouts** should be 0 for all baseline runs. Any errors in a local baseline test indicate a configuration or resource problem that must be resolved before the results are meaningful.

**Non-2xx responses** should be 0 for health and authenticated tests (all requests use a valid JWT). For the rate-limit check, non-2xx are expected and intentional (401 then 429).

**Error rate should stay at 0 for baseline tests.** If errors or timeouts appear, the baseline is not valid — investigate before recording results.

---

## Current Limitations

**Same-machine benchmark.** The load generator and the API run on the same machine, sharing CPU and memory. This inflates req/sec and deflates latency compared to real client-to-server traffic. The baseline is useful for comparing runs against each other, not for predicting absolute production performance.

**No MongoDB Atlas in the local stack.** The local MongoDB container has different performance characteristics from MongoDB Atlas (no replica set overhead, no shared cluster throttling, no WAN round-trip). Authenticated endpoint results from the local stack are optimistic compared to production.

**Docker networking overhead.** Requests go from the load generator on the host, through the Docker bridge network, to the API container, then to the MongoDB/Redis containers. This is slightly slower than a pure-process baseline but closer to real deployment architecture.

**In-memory application metrics reset on restart.** The System Health dashboard metrics and application event ring buffer are in-process. They reset on every `docker compose down`/`up`. This is expected; it does not affect load test results.

**Single-instance only.** This baseline reflects one API container behind no load balancer. Multi-instance results (ECS Fargate + ALB) will differ — the ALB adds a small per-request overhead, but horizontal scaling increases total throughput proportionally.

**Small data volume.** Seed data has 3 demo users and however many test tickets/KB articles exist. MongoDB query performance scales with data volume. Re-run the baseline after populating realistic data volumes to get representative authenticated endpoint results.

---

## Future Comparison Points

Record a new baseline run after each of the following changes, then compare against this document:

| Change | What to expect |
|---|---|
| ECR image push + EC2 pull deploy | Similar or better: image is pre-built, deploy is faster, no runtime change |
| CloudWatch Logs `awslogs` driver | Minimal impact: log shipping is async and buffered |
| ALB in front of API (Stage C) | Small overhead per request (~0.1–1 ms) from ALB target group routing |
| ECS Fargate migration | Baseline changes: Fargate vCPU/memory allocation determines throughput ceiling |
| Managed Redis (ElastiCache) | Rate-limit store calls now have WAN latency — minor impact on auth endpoints only |
| MongoDB Atlas tier upgrade | Dashboard and ticket list latency may improve under larger data volumes |
| MongoDB index review under larger data | Authenticated endpoint latency should improve for queries on indexed fields |
| Additional compound indexes | Measure impact on `/api/tickets` and `/api/kb` specifically |
