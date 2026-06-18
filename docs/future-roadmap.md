# CloudDesk — Future Roadmap

Stage 1 is a fully functional local MVP. This document outlines the planned progression through Stage 4.

---

## Chapter 2 Foundation (Complete)

Before AWS deployment, two foundational pieces were added:

**Local Docker Compose**
- `server/Dockerfile` — Node 20 Alpine, TypeScript compile, `npm start`
- `docker-compose.yml` — `clouddesk-api` + `clouddesk-mongo` services, named volume for persistence
- React client remains on `npm run dev` locally; Vite proxies `/api` to the container
- This establishes the container image that will be pushed to ECR and run on ECS in Stage 2

**GitHub Actions CI**
- `.github/workflows/ci.yml` — two jobs (`server`, `client`) run on push and PR to `main`
- Each job: `npm ci` + `npm run build` — validates TypeScript compilation and Vite build
- No MongoDB required in CI — build validation only
- CD (deploy to AWS) is Stage 2 work

**AWS Deployment Planning**
- `docs/aws-deployment-runbook.md` — full step-by-step deployment guide: MongoDB Atlas, EC2, Docker Compose, S3, CloudFront, smoke test checklist, rollback and teardown plans
- `docs/aws-cost-control.md` — budget alerts, billing alarms, low-cost architecture choices, teardown checklist, cost risk notes
- Actual AWS deployment is Stage 2 work

---

## Stage 2 — AWS Deployment

**Goal:** Deploy CloudDesk to a production-grade AWS environment accessible via a public URL.

### Infrastructure

| Component | Service | Notes |
|---|---|---|
| React SPA | S3 + CloudFront | Static asset hosting with CDN |
| Express API | ECS Fargate or EC2 | Containerised or direct deploy |
| Database | MongoDB Atlas | Managed cluster, VPC peering |
| Secrets | AWS Secrets Manager | `JWT_SECRET`, DB credentials |
| DNS | Route 53 | Custom domain (e.g. clouddesk.moseswork.dev) |
| TLS | ACM (Certificate Manager) | HTTPS on CloudFront and ALB |

### Tasks

- [x] Dockerise the Express API (`Dockerfile` + `docker-compose` for local parity) — complete
- Set up MongoDB Atlas cluster with IP allowlist and Atlas user
- Create ECS task definition or EC2 launch template
- Configure Application Load Balancer with HTTPS listener
- Deploy React build to S3, configure CloudFront distribution
- Set environment variables via Secrets Manager or Parameter Store
- IAM: create least-privilege roles for ECS task execution, S3 access
- Write deployment runbook in `docs/deployment.md`

### Not included in Stage 2

- CI/CD pipeline (Stage 3)
- S3 ticket attachments (Stage 3)
- CloudWatch monitoring (Stage 3)

---

## Stage 3 — Observability and Attachments

**Goal:** Add operational visibility and file attachment support — features expected in a production support platform.

### Observability (Phase 6 — In Progress)

Phase 6 is delivering the monitoring foundation in three tasks:

- **Phase 6.1 — Backend monitoring foundation** ✅ Complete
  - `pino` + `pino-http` structured JSON request logging (Authorization and password fields redacted)
  - Optional `@sentry/node` error tracking (`SENTRY_ENABLED=false` by default, DSN never committed)
  - Enriched health endpoints: `GET /api/health`, `GET /api/health/live`, `GET /api/health/ready` (MongoDB readiness check)
  - Global JSON error handler — no HTML error pages in production
  - Graceful shutdown on SIGTERM/SIGINT
  - `docs/monitoring-runbook.md` with health commands, log format, and incident response

- **Phase 6.2 — Frontend Sentry monitoring** ✅ Complete
  - `@sentry/react` in `client/` (matches backend `@sentry/node` version)
  - `client/src/monitoring/sentry.ts` — optional init, `captureFrontendException` helper
  - `Sentry.ErrorBoundary` wraps app in `main.tsx` when `VITE_SENTRY_ENABLED=true`
  - `AppErrorFallback` component — clean fallback UI, no stack traces shown to user
  - Axios response interceptor in `http.ts` — captures 5xx and network errors only (no auth headers, tokens, or request bodies)
  - `client/.env.example` with `VITE_SENTRY_*` vars; `client/src/vite-env.d.ts` for TypeScript env types
  - `sendDefaultPii: false`, no session replay, privacy-safe by default

- **Phase 6.3 — Admin System Health dashboard** ✅ Complete
  - Admin-only `GET /api/system/health` — full system health, runtime, DB counts, request metrics, route metrics
  - Admin-only `GET /api/system/events` — last 200 sanitized application events (no bodies, headers, or credentials)
  - In-memory request metrics collector with path sanitization (ObjectIds replaced with `:id`)
  - Safe application events ring buffer (capped at 200, resets on restart)
  - Frontend System Health page at `/admin/system-health`: status cards, runtime, application data, request metrics, method breakdown, route metrics table, Recent Application Events toggle
  - `docs/incident-response-runbook.md` — 14-incident response guide

Remaining Stage 3 observability work:

- **CloudWatch Logs** — Ship Docker container logs to CloudWatch Logs for persistence beyond the EC2 instance
- **CloudWatch Metrics** — Custom metrics for ticket creation rate, open ticket count, API error rate
- **SLA alerting** — CloudWatch Alarm when unresolved Critical tickets exceed a configurable threshold
- **Dashboard enhancements** — Average resolution time, SLA compliance rate

### File Attachments

- **S3 upload** — Presigned URL pattern: client requests upload URL from API, uploads directly to S3
- **Ticket attachments** — Attach files (screenshots, logs) to tickets; store S3 object keys on Ticket document
- **IAM** — API has `s3:PutObject` and `s3:GetObject` on the attachments bucket; no public access

### CI/CD

- **CI** — ✅ GitHub Actions build validation on push/PR to `main` (complete — see Chapter 2 Foundation)
- **CD** — Deploy on merge to main: build Docker image, push to ECR, update ECS service
- **Environment promotion** — Staging environment mirrors production; merge to `main` deploys to staging, manual approval promotes to production

---

## Phase 7 — Scalability and Resilience

**Goal:** Evolve CloudDesk from a single-instance deployment to a horizontally scalable, observable architecture. Document the migration path, fix the immediate scale-readiness gaps in the application, and demonstrate cloud architecture thinking for portfolio and interview contexts.

### Phase 7.1 — Scalability Architecture Plan ✅ Complete

- `docs/scalability-plan.md` — documents current architecture, scale-friendly foundations, current limitations, target scalable architecture (ECS/Fargate + ALB + ECR + CloudWatch), and a staged migration roadmap (Stages A–D)
- Scale-readiness checklist — identifies what is complete and what remains
- Cost-control guidance — stages each migration step by approximate monthly cost impact
- Employer-facing summary — frames the architectural thinking for portfolio use

### Phase 7.2 — Backend Scale-Readiness Improvements ✅ Complete

- **Redis-ready rate limiting** — `server/src/middleware/rateLimit.ts` replaces the inline `express-rate-limit` setup in `index.ts`. Uses `ioredis` + `rate-limit-redis` when `REDIS_URL` is set; falls back to per-process in-memory store when unset. Redis errors are caught and logged without crashing the process. `docker-compose.yml` sets `REDIS_URL=redis://redis:6379` automatically via the new `clouddesk-redis` service.
- **MongoDB compound indexes** — `Ticket` model gains four indexes (`requester+createdAt`, `status+createdAt`, `assignedTo+status`, `priority+status`). `KnowledgeArticle` model gains two indexes (`isPublished+createdAt`, `isPublished+category`). All indexes are additive and safe to apply against a running database.
- **Fix `bg-navy-500` in DashboardPage** — `navy-500` is not defined in `tailwind.config.js` (scale is 950/900/800/700/600/400/300). The 'Closed' status bar class corrected to `bg-navy-600`.
- **Scale-readiness checklist updated** — `docs/scalability-plan.md` checklist now marks Redis rate limiting and MongoDB indexes as complete.

### Phase 7.3 — Load Testing Baseline ✅ Complete

- **`load-tests/` directory** — isolated Node.js package with `autocannon` as the only dependency; does not touch server or client production dependencies
- **`load-tests/scripts/health-baseline.js`** — unauthenticated load test against `GET /api/health` and `GET /api/health/ready`; 10 connections, 20s per endpoint by default; prints req/sec, avg latency, p97.5, p99, errors, timeouts, non-2xx
- **`load-tests/scripts/authenticated-baseline.js`** — authenticated read endpoint test against `GET /api/dashboard`, `GET /api/tickets`, `GET /api/kb`; logs in **once** at the start and reuses the JWT for all connections (avoids hammering the auth rate-limited endpoint); 5 connections, 20s per endpoint by default; never prints JWT or password
- **`load-tests/scripts/rate-limit-check.js`** — sequential functional check (25 invalid logins with fake credentials) confirming that auth rate limiting (20 req/15 min) produces 429 responses; not a throughput test
- **`load-tests/README.md`** — setup, usage, safety rules, environment variable reference, metrics explanation
- **`docs/load-testing-baseline.md`** — test environment documentation, scenario descriptions, results tables (to be filled after first run), metrics interpretation, limitations, and future comparison points
- All scripts target `http://localhost:5001` by default — set `BASE_URL` to override; do not run aggressively against production

### Phase 7.4A — CloudWatch Logs Integration Preparation ✅ Complete

- **`docker-compose.cloudwatch.yml`** — Compose override file that adds the Docker `awslogs` logging driver to the `api` service; uses EC2 IAM instance profile authentication; no AWS credentials in the file
- `awslogs-create-group: "false"` — log group must be created manually before use, ensuring retention is configured intentionally
- **`docs/cloudwatch-logs.md`** — full integration guide: required AWS setup (log group creation, retention, IAM policy), EC2 commands, AWS CLI verification, rollback procedure, cost control, future improvements

### Phase 7.4C — CloudWatch Logs CI/CD Persistence ✅ Complete

- CloudWatch log group `/clouddesk/api` created in `us-east-1` with 7-day retention
- EC2 IAM instance role configured with `logs:CreateLogStream`, `logs:PutLogEvents`, `logs:DescribeLogStreams`, `logs:DescribeLogGroups`
- CloudWatch logging manually verified on EC2 — logs visible in CloudWatch console
- **`.github/workflows/deploy.yml`** updated — backend deploys now use `-f docker-compose.cloudwatch.yml` by default with `AWS_REGION=us-east-1` and `CLOUDWATCH_LOG_GROUP=/clouddesk/api`
- Pre-flight checks added to deploy workflow: file existence checks and CloudWatch IAM permission verification via `aws logs describe-log-groups`
- Failure diagnostics updated to include CloudWatch CLI hint instead of relying only on `docker compose logs`
- CloudWatch is now the source of truth for production API logs — `docker compose logs api` returns empty output when the `awslogs` driver is active
- Future items: metric filters and CloudWatch alarms (Phase 7.4B)

### Phase 7.5 — CloudWatch Metric Filters and Alarm Preparation ✅ Complete

- **`ops/cloudwatch/create-metric-filters.sh`** — creates 4 CloudWatch Logs metric filters on `/clouddesk/api`: `Api5xxCount`, `Api4xxCount`, `AppErrorLogCount`, `ApiHighLatencyCount`; idempotent; no high-cardinality dimensions
- **`ops/cloudwatch/create-alarms.sh`** — creates 4 CloudWatch alarms on the `CloudDesk/API` custom namespace; all alarms created with `--no-actions-enabled` (no SNS notifications by default); threshold variables documented in script
- **`ops/cloudwatch/verify-cloudwatch-alerting.sh`** — read-only script that lists metric filters, custom metrics, and alarm states
- **`ops/cloudwatch/delete-cloudwatch-alerting.sh`** — cost-control cleanup script; deletes filters and alarms but not the log group or log data
- **`ops/cloudwatch/README.md`** — full setup guide: IAM permissions, setup commands, test event generation, SNS wiring instructions, cost control, cleanup
- `docs/cloudwatch-logs.md`, `docs/monitoring-runbook.md`, `docs/incident-response-runbook.md` updated with alarm documentation and alarm-triggered response steps
- No AWS resources are created automatically from CI/CD — scripts are run manually from an authenticated terminal
- **Future:** SNS email notification actions, Slack/PagerDuty webhook, CloudWatch dashboard widgets, alarm threshold tuning after real traffic baselines

### Phase 7.6 — ECR + ECS/Fargate Migration (Future — cost-gated)

- Build Docker image in CI, push to ECR with git SHA tag
- Create ECS cluster and Fargate task definition
- Deploy ALB with `/api/health/ready` target group health check
- Update CloudFront `/api/*` origin from EC2 to ALB DNS
- Move secrets to SSM Parameter Store or Secrets Manager
- Update CI/CD to push to ECR and update ECS service instead of SSH-deploying to EC2

---

## Stage 4 — ServiceNow Workflow Mapping and Advanced Support

**Goal:** Deepen the ITSM feature set to more closely mirror enterprise ServiceNow functionality.

### ServiceNow Workflow Mapping

| CloudDesk feature | ServiceNow equivalent |
|---|---|
| Ticket | Incident / Service Request |
| Category | Category / Subcategory |
| Priority | Priority (P1–P4) |
| Status | State (New, In Progress, Resolved, Closed) |
| Assignee | Assigned to (User) |
| Assignment group | (future: team/group model) |
| Internal note | Work note |
| Public comment | Additional comments |
| Knowledge article | Knowledge Base article |
| Dashboard | Reports / Service Desk overview |

### SLA Rules

- Priority-based response time targets (e.g. Critical: 1 hour, High: 4 hours)
- SLA breach flag on overdue tickets — visible on dashboard and ticket list
- SLA pause/resume on status transitions (e.g. paused when Resolved)

### Escalation Matrix

- Auto-escalate Critical tickets unassigned after N minutes
- Notify admin on escalation via email
- Audit log of escalation events on ticket

### Email Notifications (AWS SES)

- New ticket created — notification to requester
- Ticket assigned — notification to assigned agent
- Status update — notification to requester
- Comment added (public) — notification to requester and assigned agent

### Advanced User Management

- Admin UI for creating support agent and admin accounts (production agents are currently provisioned via the `create-admin` CLI; a frontend form will replace this for agent accounts)
- Admin UI for user listing, role changes
- Account deactivation (soft delete)
- Bulk ticket reassignment when an agent is deactivated

---

## Out of Scope (All Stages)

- Real ServiceNow API integration (read/write to a live ServiceNow instance)
- Multi-tenant organisation support
- AI/LLM chatbot or ticket auto-classification
- Payment processing
- LDAP/Active Directory integration
