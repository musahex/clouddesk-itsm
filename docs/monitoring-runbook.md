# CloudDesk — Monitoring Runbook

This runbook covers backend observability for CloudDesk: health checks, structured logging, optional Sentry error tracking, and how to diagnose common incidents.

---

## Purpose

CloudDesk uses three layers of monitoring:

| Layer | Tool | Status |
|---|---|---|
| Structured request logging | pino + pino-http | Active (Phase 6.1) |
| Health / liveness / readiness | Express health routes | Active (Phase 6.1) |
| Backend error tracking | Sentry (`@sentry/node`) | Optional — disabled by default |
| Frontend error tracking | Sentry (`@sentry/react`) | Planned (Phase 6.2) |
| Admin health dashboard | System Health page | Planned (Phase 6.3) |
| CloudWatch log shipping | CloudWatch Logs agent | Planned (Stage 3) |

---

## Sentry Backend Setup

Sentry is **optional** and disabled by default. The app runs normally with `SENTRY_ENABLED=false`.

### Required environment variables (when enabling)

| Variable | Required | Description |
|---|---|---|
| `SENTRY_ENABLED` | No | Set to `true` to enable. Default: `false`. |
| `SENTRY_DSN` | If enabled | Your Sentry project DSN. Never commit this value. |
| `SENTRY_ENVIRONMENT` | No | Defaults to `NODE_ENV` (e.g. `production`). |
| `SENTRY_RELEASE` | No | Defaults to `clouddesk-api@local`. Set to a version tag in production. |

### Enable Sentry locally

```bash
# In server/.env — do not commit
SENTRY_ENABLED=true
SENTRY_DSN=https://your-dsn@sentry.io/123456
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=clouddesk-api@dev
```

Then restart the dev server:

```bash
cd server && npm run dev
```

### Enable Sentry on EC2

SSH into the EC2 instance and edit `server/.env`:

```bash
ssh -i your-key.pem ec2-user@<EC2-PUBLIC-IP>
cd clouddesk-itsm
nano server/.env
```

Add or update:

```env
SENTRY_ENABLED=true
SENTRY_DSN=https://your-dsn@sentry.io/123456
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=clouddesk-api@1.0.0
```

Restart the container:

```bash
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml logs api --tail=20
```

### Verify Sentry is active

The `/api/health` endpoint reports `sentryEnabled: true` when active:

```bash
curl http://localhost:5001/api/health
# → { ..., "sentryEnabled": true, ... }
```

---

## Health Endpoints

Three health endpoints are available without authentication.

### GET /api/health

General health — always returns 200. Used as the deploy gate in CI/CD.

```bash
# Local
curl http://localhost:5001/api/health

# Production (via CloudFront)
curl https://<cloudfront-domain>/api/health
```

Example response:

```json
{
  "status": "ok",
  "service": "CloudDesk API",
  "environment": "production",
  "sentryEnabled": true,
  "timestamp": "2026-05-24T10:00:00.000Z",
  "uptimeSeconds": 3600
}
```

### GET /api/health/live

Liveness — confirms the Node.js process is alive. Always 200.

```bash
curl http://localhost:5001/api/health/live
```

Example response:

```json
{
  "status": "alive",
  "service": "CloudDesk API",
  "timestamp": "2026-05-24T10:00:00.000Z"
}
```

### GET /api/health/ready

Readiness — confirms the service can handle traffic (MongoDB connected). Returns 200 if ready, 503 if not.

```bash
# Local
curl http://localhost:5001/api/health/ready

# Production (via CloudFront)
curl https://<cloudfront-domain>/api/health/ready
```

Ready response (200):

```json
{
  "status": "ready",
  "database": "connected",
  "timestamp": "2026-05-24T10:00:00.000Z"
}
```

Not ready response (503):

```json
{
  "status": "not_ready",
  "database": "disconnected",
  "timestamp": "2026-05-24T10:00:00.000Z"
}
```

---

## Structured Logging

The API emits JSON log lines via `pino`. On EC2, these appear in Docker Compose output.

### View logs on EC2

```bash
# Last 100 lines
docker compose -f docker-compose.prod.yml logs api --tail=100

# Stream live
docker compose -f docker-compose.prod.yml logs -f api

# Container status
docker compose -f docker-compose.prod.yml ps
```

### Log format

Each line is a JSON object. Key fields:

| Field | Description |
|---|---|
| `level` | Numeric log level: 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal |
| `time` | Unix timestamp in milliseconds |
| `msg` | Log message |
| `req.method` | HTTP method |
| `req.url` | Request path |
| `res.statusCode` | HTTP status code |
| `responseTime` | Milliseconds taken |
| `err` | Error object (on error logs) |

### Redacted fields

The following fields are **never** logged:

- `req.headers.authorization` — contains the JWT bearer token
- `req.body.password` — user password field
- `req.body.token` — any token field in request body

Example log line (formatted for readability):

```json
{
  "level": 30,
  "time": 1748080000000,
  "req": { "method": "GET", "url": "/api/tickets", "remoteAddress": "10.0.0.1" },
  "res": { "statusCode": 200 },
  "responseTime": 34,
  "msg": "request completed"
}
```

---

## Common Incidents

---

### Incident: API returns 500 on a specific endpoint

**Symptoms:** A request returns `{"message":"Internal server error"}` in production or `{"message":"...","stack":"..."}` in development.

**Likely causes:**
- Unhandled database error (e.g., MongoDB validation failure)
- Bug in controller logic
- Mongoose document operation failed

**Checks:**

```bash
# View recent errors on EC2
docker compose -f docker-compose.prod.yml logs api --tail=100 | grep '"level":50'

# Check if Sentry received the error
# Log into sentry.io → your project → Issues
```

**Fix:** Identify the failing request from logs (URL, method, timestamp). Review the relevant controller. If the error is a database schema mismatch, check model validation.

**Prevention:** Review Sentry alerts after deployments. Add integration tests for critical paths.

---

### Incident: /api/health/ready returns 503

**Symptoms:** `curl https://<cloudfront-domain>/api/health/ready` returns 503 with `"database":"disconnected"`.

**Likely causes:**
- MongoDB Atlas cluster is paused, down, or unreachable
- EC2 outbound connection to Atlas blocked (security group or Atlas IP allowlist)
- Atlas free tier M0 auto-paused due to inactivity

**Checks:**

```bash
# On EC2 — check API logs for connection errors
docker compose -f docker-compose.prod.yml logs api --tail=50

# Check Atlas cluster status in Atlas console
# Atlas → Clusters → your cluster → check status indicator

# Test Atlas connection from EC2
mongosh "mongodb+srv://..." --eval "db.runCommand({ ping: 1 })"
```

**Fix:**
1. If Atlas is paused: resume the cluster in the Atlas console
2. If IP allowlist issue: add EC2's current public IP in Atlas → Network Access
3. If Atlas is down: check the MongoDB Atlas status page

**Prevention:** Use M10 or higher in production — M0 free tier auto-pauses after 60 days of inactivity. Enable Atlas monitoring alerts.

---

### Incident: MongoDB Atlas connection issue after EC2 restart

**Symptoms:** API starts but `/api/health/ready` returns 503. Logs show MongoDB connection errors.

**Likely cause:** EC2 instance got a new public IP after restart. The old IP is in the Atlas IP allowlist but the new one is not.

**Fix:**

```bash
# Find the new public IP from EC2 console or
curl https://checkip.amazonaws.com

# Add this IP to Atlas → Network Access → Add IP Address
```

**Prevention:** Use a static Elastic IP on EC2, or add a broad CIDR range (with caution). Consider AWS VPC peering with Atlas for production.

---

### Incident: CloudFront /api returns 504 Gateway Timeout

**Symptoms:** Requests to `https://<cloudfront-domain>/api/*` return 504.

**Likely causes:**
- EC2 instance is stopped or terminated
- Docker container has exited
- Security group blocks CloudFront

**Checks:**

```bash
# From local machine — test EC2 directly (if SG allows port 5001)
curl http://<EC2-PUBLIC-IP>:5001/api/health

# On EC2
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs api --tail=30
```

**Fix:**
1. If container is down: `docker compose -f docker-compose.prod.yml up -d`
2. If instance is stopped: start it from EC2 console
3. If security group issue: verify CloudFront IP ranges are allowed or the EC2 SG allows inbound on port 5001 from CloudFront

**Prevention:** Enable CloudWatch alarm for EC2 status checks.

---

### Incident: CORS issue after frontend domain change

**Symptoms:** Browser requests fail with CORS errors after deploying to a new CloudFront domain.

**Likely cause:** `CLIENT_URL` in `server/.env` on EC2 still points to the old domain.

**Fix:**

```bash
# On EC2
nano server/.env
# Update CLIENT_URL to the new CloudFront domain

docker compose -f docker-compose.prod.yml restart api
```

**Verify:**

```bash
curl -H "Origin: https://new-domain.cloudfront.net" \
  -v http://localhost:5001/api/health 2>&1 | grep -i "access-control"
```

---

### Incident: Sentry not receiving backend events

**Symptoms:** Errors occur but no events appear in the Sentry dashboard.

**Checks:**

```bash
# Verify sentryEnabled in health response
curl http://localhost:5001/api/health
# Look for "sentryEnabled": true

# Verify env vars are set on EC2
docker compose -f docker-compose.prod.yml exec api printenv | grep SENTRY
```

**Likely causes:**
- `SENTRY_ENABLED` is `false` or not set to exactly `"true"`
- `SENTRY_DSN` is empty or incorrect
- DSN is for the wrong Sentry project

**Fix:** Correct `SENTRY_ENABLED=true` and `SENTRY_DSN=<your-dsn>` in `server/.env`. Restart the container.

---

## Log Level Reference

| Level | Number | When used |
|---|---|---|
| trace | 10 | Verbose debugging |
| debug | 20 | Debugging information |
| info | 30 | Normal operational events (startup, request completed) |
| warn | 40 | Non-critical issues (dev admin creation) |
| error | 50 | Errors that need attention |
| fatal | 60 | Critical failure — process will exit |

Default level is `info`. Override with `LOG_LEVEL=debug` in `.env`.
