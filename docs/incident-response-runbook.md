# CloudDesk — Incident Response Runbook

Quick reference for diagnosing and resolving production incidents. Each entry follows: **Symptoms → Likely Cause → Checks → Fix → Prevention**.

---

## 1. API health check fails

**Symptoms:** `curl https://<cloudfront-domain>/api/health` returns non-200, times out, or the GitHub Actions deploy step reports health check failure after 30 attempts.

**Likely cause:**
- Docker container failed to start (TypeScript build error, missing env var)
- `server/.env` on EC2 is missing `MONGO_URI`, `JWT_SECRET`, or `CLIENT_URL`
- Port 5001 is blocked or the container exited immediately

**Checks:**
```bash
# On EC2
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs api --tail=50

# Test directly
curl -v http://localhost:5001/api/health

# If CloudWatch Logs is active (see docs/cloudwatch-logs.md)
aws logs filter-log-events --log-group-name /clouddesk/api --region us-east-1 --limit 20
```

**Fix:**
1. Check logs for the startup error (env validation, TypeScript compile error, or database connection error)
2. Confirm `server/.env` contains all required variables
3. `docker compose -f docker-compose.prod.yml up -d --build`

**Prevention:** Keep `server/.env` up to date on EC2; do not delete it. The CI deploy step fails fast if `SENTRY_API_DSN` is missing.

---

## 2. /api/health/ready returns 503

**Symptoms:** `/api/health/ready` returns `{"status":"not_ready","database":"disconnected"}`. API responds to other requests with 500 or DB-related errors.

**Likely cause:**
- MongoDB Atlas cluster is paused or unreachable
- EC2's public IP changed after restart and is no longer on the Atlas IP allowlist
- Atlas free tier (M0) auto-paused after inactivity

**Checks:**
```bash
# On EC2 — look for mongoose connection errors
docker compose -f docker-compose.prod.yml logs api --tail=50

# Test Atlas connection from EC2
mongosh "mongodb+srv://..." --eval "db.runCommand({ ping: 1 })"

# Check current public IP
curl https://checkip.amazonaws.com
```

**Fix:**
1. If Atlas is paused: resume from Atlas console → Clusters
2. If IP allowlist mismatch: Atlas → Network Access → Add IP
3. If `MONGO_URI` is wrong: check `server/.env`, restart container

**Prevention:** Use a static Elastic IP on EC2 so the IP never changes on restart. Use M10+ in production to avoid auto-pause.

---

## 3. MongoDB Atlas connection fails after EC2 restart

**Symptoms:** API starts but `/api/health/ready` returns 503 immediately. Logs show `MongoNetworkError` or timeout.

**Likely cause:** EC2 got a new public IP on restart. The old IP is in the Atlas allowlist; the new one is not.

**Checks:**
```bash
curl https://checkip.amazonaws.com
# Compare with Atlas → Network Access → IP Access List
```

**Fix:**
```bash
# Get new IP
NEW_IP=$(curl -s https://checkip.amazonaws.com)
echo "Add this IP to Atlas: $NEW_IP"
# Then in Atlas: Network Access → Add IP Address → paste IP
```

**Prevention:** Assign an Elastic IP to the EC2 instance. This IP persists across restarts and only needs to be added to the Atlas allowlist once.

---

## 4. CloudFront /api returns 504 Gateway Timeout

**Symptoms:** `https://<cloudfront-domain>/api/*` returns HTTP 504. Browser shows network error or timeout. The `/api/health` check on the System Health page fails.

**Likely cause:**
- EC2 instance stopped or terminated
- Docker container exited
- CloudFront cannot reach EC2 (security group blocks port 5001)
- CloudFront origin timeout (default 30 s)

**Checks:**
```bash
# From local (if SG allows 5001 from your IP)
curl http://<EC2-PUBLIC-IP>:5001/api/health

# On EC2
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs api --tail=30
```

**Fix:**
1. If container is stopped: `docker compose -f docker-compose.prod.yml up -d`
2. If EC2 is stopped: start from EC2 console
3. If SG issue: confirm EC2 security group allows inbound TCP 5001 from CloudFront (or the ALB)
4. Check CloudFront origin settings match EC2 IP and port

**Prevention:** Set a CloudWatch alarm on EC2 status checks. Consider attaching an Application Load Balancer for health-checked routing.

---

## 5. S3 frontend returns AccessDenied

**Symptoms:** `https://<cloudfront-domain>/` returns XML AccessDenied or 403. No React app loads.

**Likely cause:**
- S3 bucket policy does not allow CloudFront OAC/OAI to read objects
- S3 bucket public access was re-blocked
- Wrong CloudFront origin configured (S3 REST endpoint vs website endpoint)

**Checks:**
```bash
# Test S3 object access via CloudFront
curl -I https://<cloudfront-domain>/index.html
```

**Fix:**
1. Confirm the S3 bucket policy grants `s3:GetObject` to the CloudFront distribution's OAC/OAI principal
2. Confirm "Block all public access" settings do not block the CloudFront OAC policy
3. Re-run `aws s3 sync client/dist s3://$S3_BUCKET --delete` and invalidate

**Prevention:** Document the bucket policy alongside the CloudFront distribution ID in the deployment runbook.

---

## 6. React route refresh returns AccessDenied or 403

**Symptoms:** Navigating directly to `/tickets`, `/kb`, or `/admin/system-health` returns S3 AccessDenied or a 403 XML response instead of the React app.

**Likely cause:** CloudFront is not configured to return `index.html` for all non-file paths. S3 returns 403/404 for paths that don't correspond to S3 objects.

**Checks:**
```bash
curl -I https://<cloudfront-domain>/tickets
# Should return 200 with Content-Type: text/html, not 403 XML
```

**Fix:** Add a CloudFront custom error response:
- Error code: 403 → Response page: `/index.html` → Response code: 200
- Error code: 404 → Response page: `/index.html` → Response code: 200

This turns all deep-link requests into SPA-handled routes.

**Prevention:** Configure custom error responses immediately when creating the CloudFront distribution (step in `docs/aws-deployment-runbook.md`).

---

## 7. CORS blocks login/register

**Symptoms:** Browser console shows `CORS policy: No 'Access-Control-Allow-Origin' header`. Login and register API calls fail.

**Likely cause:**
- `CLIENT_URL` in `server/.env` on EC2 does not match the actual CloudFront domain
- CloudFront domain changed (new distribution created)

**Checks:**
```bash
# From EC2 — test CORS response
curl -H "Origin: https://your-cloudfront-domain.cloudfront.net" \
  -v http://localhost:5001/api/health 2>&1 | grep -i "access-control"
```

**Fix:**
```bash
# On EC2
nano server/.env
# Set CLIENT_URL=https://your-actual-cloudfront-domain.cloudfront.net
docker compose -f docker-compose.prod.yml restart api
```

**Prevention:** The CI deploy upserts Sentry env vars but does not touch `CLIENT_URL` — update it manually whenever the CloudFront domain changes.

---

## 8. Sentry not receiving backend events

**Symptoms:** Backend errors occur but no issues appear in the Sentry `clouddesk-api` project.

**Likely cause:**
- `SENTRY_ENABLED` is not `"true"` (exact string match required)
- `SENTRY_DSN` is empty or invalid
- DSN is for the wrong Sentry project

**Checks:**
```bash
# Confirm sentryEnabled in health response
curl http://localhost:5001/api/health | grep sentryEnabled
# Should be: "sentryEnabled": true

# Confirm env vars are set in the running container
docker compose -f docker-compose.prod.yml exec api printenv | grep SENTRY
```

**Fix:** Correct `SENTRY_ENABLED=true` and `SENTRY_DSN=<your-dsn>` in `server/.env`, then restart:
```bash
docker compose -f docker-compose.prod.yml restart api
```

The CI deploy sets these automatically from the `SENTRY_API_DSN` GitHub secret.

**Prevention:** Confirm `sentryEnabled: true` in the `/api/health` response after every deploy.

---

## 9. Sentry not receiving frontend events

**Symptoms:** Frontend errors occur but no issues appear in the Sentry `clouddesk-web` project.

**Likely cause:**
- `VITE_SENTRY_ENABLED` was not set to `"true"` at build time
- `VITE_SENTRY_DSN` was empty at build time — the bundle silently skips init
- DSN is for the wrong Sentry project

**Checks:**
```bash
# In browser console on the deployed app
# Sentry would log a warning in DEV mode but not production
# Instead check: the CI build step must have VITE_SENTRY_DSN set
# Look at the GitHub Actions run for deploy-frontend → Build client step
```

**Fix:** Confirm the `SENTRY_WEB_DSN` GitHub secret is set and non-empty. Re-run the deploy from the GitHub Actions tab. The build step fails fast if `VITE_SENTRY_DSN` is empty.

**Prevention:** Check for `SENTRY_WEB_DSN` in the GitHub secrets list before the first production deploy (Section E of the production readiness checklist).

---

## 10. GitHub Actions deploy failed

**Symptoms:** Push to `main` triggers the workflow but `deploy-backend` or `deploy-frontend` fails.

**Likely cause:**
- A secret is missing (deploy fails fast with a clear message)
- SSH connection refused (wrong IP, SG change, EC2 stopped)
- TypeScript build error in the `validate` job
- `npm ci` fails (lockfile out of sync)

**Checks:**
1. Open the failed workflow run in GitHub → Actions
2. Expand the failed step — the error message is in the log
3. For SSH failures: try connecting manually: `ssh -i key.pem ec2-user@<EC2_HOST>`
4. For build failures: run `npm run build` locally

**Fix:**
- Missing secret: add it in GitHub → Settings → Secrets → Actions
- SSH failure: confirm EC2 is running and SG allows port 22 from GitHub Actions IPs
- Build failure: fix the TypeScript error in the failing package

**Prevention:** Run `cd server && npm run build && cd ../client && npm run build` before pushing to `main`.

---

## 11. EC2 disk space issue

**Symptoms:** Docker `up --build` fails with "no space left on device". Container logs show write errors.

**Likely cause:** Accumulated Docker image layers and stopped containers from repeated deploys.

**Checks:**
```bash
# On EC2
df -h
docker system df
docker images
```

**Fix:**
```bash
# Remove unused images, containers, volumes
docker system prune -af
docker volume prune -f

# Check disk again
df -h
```

**Prevention:** The CI deploy already runs `docker image prune -f` after each build. For persistent space issues, attach a larger EBS volume or use a `t3.small` with more disk.

---

## 12. Docker container keeps restarting

**Symptoms:** `docker compose ps` shows the `api` container in a restart loop. `/api/health` never responds.

**Likely cause:**
- Startup crash due to missing env variable (MONGO_URI, JWT_SECRET, CLIENT_URL in production)
- MongoDB Atlas unreachable — `mongoose.connect()` throws and the process exits
- Out-of-memory kill (unlikely on t3.micro but possible under load)

**Checks:**
```bash
# Watch the restart behaviour
docker compose -f docker-compose.prod.yml logs api --tail=50 -f

# Check container state
docker compose -f docker-compose.prod.yml ps

# If CloudWatch Logs is active — logs from the crashed container may still be visible here
aws logs filter-log-events --log-group-name /clouddesk/api --region us-east-1 --limit 30
```

**Fix:**
1. Read the crash message in the logs — env validation errors are explicit
2. Fix the missing variable in `server/.env`
3. Confirm Atlas is reachable: `mongosh "mongodb+srv://..." --eval "db.runCommand({ ping: 1 })"`
4. Restart: `docker compose -f docker-compose.prod.yml up -d --build`

**Prevention:** Never delete `server/.env` from EC2. Run the production readiness checklist before the first deploy.

---

## 13. System Health page shows degraded or unhealthy status

**Symptoms:** The `/admin/system-health` page shows the Overall Health banner as "Degraded" (amber) or "Unhealthy" (red).

**Degraded** — API is reachable but something is wrong:
- Database status card shows "Disconnected"
- 5xx Server Err count is > 0
- API status field is `"degraded"`

**Unhealthy** — API health endpoint could not be reached at all (banner shows without data sections).

**Checks for Degraded:**
```bash
# From the System Health page: check Database status card and 5xx count
# Or from EC2 directly:
curl http://localhost:5001/api/health/ready
# → {"status":"not_ready","database":"disconnected"} means MongoDB issue

# Check for 5xx errors in recent events (System Health > Recent Application Events)
# Or in Docker logs:
docker compose -f docker-compose.prod.yml logs api --tail=50 | grep '"level":50'
```

**Checks for Unhealthy:**
```bash
# Can the health endpoint be reached at all?
curl http://localhost:5001/api/health
```

**Fix:**
- DB disconnected → see Incident #2 and #3
- Repeated 5xx → see Incident #14
- Unhealthy → EC2/Docker issue, see Incident #1 and #4

**Prevention:** Use a managed Atlas cluster (M10+). Check the Overall Health banner and 5xx count after every deployment.

---

## 14. Recent Application Events show repeated 5xx errors

**Symptoms:** The Recent Application Events panel on the System Health page shows many red `error` level rows with 5xx status codes for the same path.

**Likely cause:**
- A controller is throwing an unhandled exception on a specific route
- Database query is failing for a particular operation
- A recent deployment broke a specific endpoint

**Checks:**
```bash
# Identify the failing route from the events panel (path + method)
# Then check server logs
docker compose -f docker-compose.prod.yml logs api --tail=100 | grep '"level":50'

# Also check the Route Metrics table — high errorCount on a specific path

# If CloudWatch Logs is active — filter for level 50 (error) across all log streams
aws logs filter-log-events \
  --log-group-name /clouddesk/api \
  --region us-east-1 \
  --filter-pattern '{ $.level = 50 }' \
  --limit 20
```

**Fix:**
1. Identify the failing endpoint from the Recent Events path column
2. Read the error log for that endpoint (pino level 50 = error)
3. If Sentry is enabled, check the Sentry `clouddesk-api` project for the stack trace
4. Roll back the deployment if the error started after a recent push: `git reset --hard <prev-sha>`

**Prevention:** Review the System Health page after every deployment (part of the post-deploy smoke test checklist).

---

## 15. CloudDeskApi5xxAlarm triggered

**Symptoms:** The `CloudDeskApi5xxAlarm` transitions to ALARM state in CloudWatch (visible in CloudWatch → Alarms). One or more HTTP 5xx responses occurred within a 5-minute window.

**Likely causes:**
- A controller threw an unhandled exception
- MongoDB Atlas is unavailable or returning errors
- An upstream dependency (Redis, external service) is failing
- A recent deployment introduced a runtime error

**Checks:**
```bash
# 1. Confirm API is still responsive
curl https://d2hz1ibmz7rn7t.cloudfront.net/api/health
curl https://d2hz1ibmz7rn7t.cloudfront.net/api/health/ready

# 2. View 5xx events in CloudWatch Logs
aws logs filter-log-events \
  --log-group-name /clouddesk/api \
  --region us-east-1 \
  --filter-pattern '{ $.res.statusCode >= 500 }' \
  --limit 20

# 3. View error-level log events for context
aws logs filter-log-events \
  --log-group-name /clouddesk/api \
  --region us-east-1 \
  --filter-pattern '{ $.level >= 50 }' \
  --limit 20

# 4. Check container state on EC2
docker compose -f docker-compose.prod.yml -f docker-compose.cloudwatch.yml ps
docker inspect clouddesk-api --format '{{.State.Status}} {{.State.Error}}'

# 5. Check Sentry for stack traces (if enabled)
# → sentry.io → clouddesk-api project → Issues
```

**Fix:**
1. Identify the failing route from the CloudWatch log events (`req.url`, `req.method`, `res.statusCode`)
2. Check the error message and stack trace in pino error logs or Sentry
3. If the error started after a recent push, roll back: `git reset --hard <prev-sha>` on EC2 then `docker compose -f docker-compose.prod.yml -f docker-compose.cloudwatch.yml up -d --build`
4. If Atlas is causing the 5xx, follow Incident #2

**Prevention:** Review CloudWatch alarm state after every deployment. Check `/api/health/ready` as part of the post-deploy smoke test.

---

## 16. CloudDeskAppErrorLogAlarm triggered

**Symptoms:** The `CloudDeskAppErrorLogAlarm` transitions to ALARM state. One or more pino log events with `level >= 50` (error or fatal) occurred within 5 minutes. This alarm can fire independently of 5xx HTTP responses — a backend error may be logged before or without a corresponding error response code.

**Likely causes:**
- MongoDB connection error (Mongoose throws, logs error, API may still return 500)
- Unhandled promise rejection caught by Express error middleware
- Fatal startup event (JWT_SECRET missing, port bind failure)
- A controller caught and logged an error without re-throwing it

**Checks:**
```bash
# 1. Check API health and readiness
curl https://d2hz1ibmz7rn7t.cloudfront.net/api/health
curl https://d2hz1ibmz7rn7t.cloudfront.net/api/health/ready

# 2. Retrieve error-level log events from CloudWatch
aws logs filter-log-events \
  --log-group-name /clouddesk/api \
  --region us-east-1 \
  --filter-pattern '{ $.level >= 50 }' \
  --limit 20

# 3. Check container state
docker compose -f docker-compose.prod.yml -f docker-compose.cloudwatch.yml ps
docker inspect clouddesk-api --format '{{.State.Status}} {{.State.Error}}'

# 4. Check Sentry (if enabled) — error-level pino logs are forwarded to Sentry
# → sentry.io → clouddesk-api project → Issues
```

**Fix:**
1. Read the error log line — pino error logs include `err.message` and `err.stack` fields
2. If MongoDB related: follow Incident #2 and #3
3. If the container is in a restart loop: follow Incident #12
4. If a controller is swallowing errors: identify the route from the log context and fix or roll back

**Prevention:** Never use `catch(() => {})` without logging or re-throwing. Review the System Health dashboard → Recent Application Events after every deployment.

---

## 17. CloudDeskHighLatencyAlarm triggered

**Symptoms:** The `CloudDeskHighLatencyAlarm` transitions to ALARM state. Five or more API requests took ≥ 1000ms within a 5-minute window.

**Likely causes:**
- MongoDB Atlas is slow or reconnecting (cold connection after Atlas auto-pause)
- EC2 instance is under CPU or memory pressure
- A slow database query (missing index, large scan)
- Atlas free tier M0 throttling or connection limit reached

**Checks:**
```bash
# 1. Check API readiness — 503 confirms DB issue
curl https://d2hz1ibmz7rn7t.cloudfront.net/api/health/ready

# 2. View slow request log events in CloudWatch
aws logs filter-log-events \
  --log-group-name /clouddesk/api \
  --region us-east-1 \
  --filter-pattern '{ $.responseTime >= 1000 }' \
  --limit 20

# 3. Check EC2 CPU and memory
# → EC2 console → Monitoring tab → CPU Utilization
# Or on EC2:
top -b -n1 | head -20

# 4. Check container memory usage on EC2
docker stats clouddesk-api --no-stream
```

**Fix:**
1. If Atlas is slow to reconnect: check Atlas console → Metrics for connection count and latency. Resume a paused cluster if needed (see Incident #2)
2. If a specific route is consistently slow: check the route metrics on the System Health page for high `avgResponseTimeMs` on a path, then review that controller's DB queries for missing indexes
3. If EC2 is overloaded: consider upgrading from `t3.micro` to `t3.small`, or trigger a container restart to free leaked memory

**Prevention:** Monitor the System Health dashboard for average and slowest response times after each deployment. Use M10+ Atlas cluster to avoid auto-pause latency.

---

## Log Level Reference

| Level | Number | Meaning |
|---|---|---|
| trace | 10 | Verbose debugging |
| debug | 20 | Debug info |
| info | 30 | Normal operations |
| warn | 40 | Non-critical issues |
| error | 50 | Errors needing attention |
| fatal | 60 | Critical — process exits |

```bash
# Filter errors on EC2
docker compose -f docker-compose.prod.yml logs api | grep '"level":50'

# Stream live
docker compose -f docker-compose.prod.yml logs -f api
```

---

## Quick Diagnostic Commands

```bash
# API alive?
curl http://localhost:5001/api/health/live

# MongoDB connected?
curl http://localhost:5001/api/health/ready

# Container status
docker compose -f docker-compose.prod.yml ps

# Last 100 log lines
docker compose -f docker-compose.prod.yml logs api --tail=100

# Disk space
df -h && docker system df

# EC2 public IP (after restart)
curl https://checkip.amazonaws.com
```
