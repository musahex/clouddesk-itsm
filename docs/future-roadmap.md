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

- **Phase 6.3 — Admin System Health page** (Planned)
  - Admin-only `/admin/health` API endpoint
  - Frontend System Health page at `/admin/health`
  - Cards: API status, MongoDB status, Sentry enabled/disabled, uptime, environment, timestamp

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
