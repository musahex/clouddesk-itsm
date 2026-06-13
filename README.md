# CloudDesk ITSM Platform

A full-stack IT Service Management platform built to demonstrate end-to-end IT support workflows — from ticket submission and triage through to escalation, resolution, and knowledge base management.

![Dashboard](screenshots/dashboard.png)

---

## Why I Built This

ITSM tools like ServiceNow sit at the centre of enterprise IT support, but most developer portfolios demonstrate code skills without IT operations context — and most IT support CVs demonstrate operations knowledge without technical depth. CloudDesk bridges that gap.

The goal was to build something that an Australian IT hiring manager could look at and recognise: this person understands how a service desk actually works, and they can build the software that runs it.

---

## Employer-Facing Value

| What it demonstrates | How |
|---|---|
| IT support workflow understanding | Ticket lifecycle enforced in code: New → Assigned → In Progress → Escalated → Resolved → Closed |
| Triage and escalation thinking | Priority and category fields, status transitions, assignment workflow |
| Incident and request handling | Separate comment types (public vs. internal notes), resolution timestamps |
| Knowledge base management | Article publishing workflow with draft/publish states |
| Authentication and authorisation | JWT, bcryptjs, RBAC enforced at API level — not just the UI |
| Backend API design | RESTful Express API with consistent error handling and populated Mongoose documents |
| Application support thinking | Dashboard metrics scoped to role, structured error responses, clean audit trail |
| Cloud deployment readiness | Architecture designed for Stage 2 AWS deployment (EC2, MongoDB Atlas, S3) |

---

## Key Features

- **JWT Authentication** — Secure register/login with 7-day token expiry, password hashed with bcrypt
- **Three-Role RBAC** — `requester`, `support_agent`, and `admin` roles enforced at every API endpoint
- **Full Ticket Lifecycle** — New → Assigned → In Progress → Escalated → Resolved → Closed, with `resolvedAt` timestamp
- **Ticket Assignment** — Agents and admins can assign tickets via a populated assignee dropdown
- **Comments** — Public comments visible to all; internal notes visible only to agents and admins
- **Knowledge Base** — Agents create, edit, and publish articles; requesters browse and search published content
- **KB Search** — Search by title, content, category, and tags via dedicated search endpoint
- **Dashboard Metrics** — Ticket counts, status/priority/category breakdowns, and recent tickets — scoped by role
- **Support Agent Creation** — Admin-only browser page (`/admin/support-agents/new`) creates `support_agent` accounts with password validation
- **System Health Dashboard** — Admin-only page (`/admin/system-health`) showing API status, DB connectivity, runtime metrics, request counts, route metrics, and a sanitized application event log
- **Seed Script** — One-command demo user creation for local testing

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js 20, Express 4, TypeScript |
| Database | MongoDB, Mongoose 8 |
| Auth | JWT (jsonwebtoken), bcryptjs |
| HTTP Client | Axios |
| Dev Tools | ts-node-dev |

---

## Architecture Overview

```
┌─────────────────────────────┐
│   Browser — React SPA       │
│   (Vite dev server :5173)   │
└────────────┬────────────────┘
             │ /api/* (proxied in dev)
             ▼
┌─────────────────────────────┐
│   Express REST API :5001    │
│   authMiddleware → RBAC     │
│   routes → controllers      │
└────────────┬────────────────┘
             │ Mongoose ODM
             ▼
┌─────────────────────────────┐
│   MongoDB                   │
│   Users · Tickets · KB      │
└─────────────────────────────┘
```

See [docs/architecture.md](docs/architecture.md) for the full architecture document.

---

## User Roles

| Role | Permissions |
|---|---|
| `requester` | Register, login, create tickets, view own tickets, comment on own tickets, read published KB articles |
| `support_agent` | View all tickets, update status, assign tickets, add internal notes, create/edit KB articles |
| `admin` | All agent permissions + delete KB articles + create support agent accounts |

---

## Demo Credentials (Local Only)

> These credentials are for local portfolio demonstration only. Do not use in production.

**Seeded via `npm run seed` (`server/`):**

| Role | Email | Password |
|---|---|---|
| Requester | requester@clouddesk.dev | Password123! |
| Support Agent | agent@clouddesk.dev | Password123! |
| Admin | admin@clouddesk.dev | Password123! |

**Auto-created at server startup (dev only, `NODE_ENV !== production`):**

| Role | Email | Password | Note |
|---|---|---|---|
| Admin | admin@clouddesk.com | admin | Weak password — local convenience only |

---

## Local Setup

### Prerequisites

- Node.js 20+
- MongoDB running locally, or a MongoDB Atlas connection string

### 1. Clone the repository

```bash
git clone https://github.com/musahex/clouddesk-itsm.git
cd clouddesk-itsm
```

### 2. Configure the server environment

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env`:

```
PORT=5001
MONGO_URI=mongodb://localhost:27017/clouddesk
JWT_SECRET=your-secret-key-change-this
```

### 3. Start the server

```bash
npm run dev
```

Server runs on `http://localhost:5001`. On first startup in development (`NODE_ENV !== production`), a default admin account is automatically created:

```
Email:    admin@clouddesk.com
Password: admin
```

This account is skipped silently if it already exists and is never created in production.

### 4. Seed demo users

```bash
npm run seed
```

Creates the three demo users if they do not already exist. Safe to re-run.

### 5. Start the client

Open a new terminal:

```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173`. All `/api` requests proxy to the server automatically — no CORS configuration needed in development.

### 6. Verify

```bash
curl http://localhost:5001/api/health
# → {"status":"ok","service":"CloudDesk API"}
```

Then open `http://localhost:5173` and log in with any demo credential.

---

## Docker Compose Files

| File | Use | MongoDB |
|---|---|---|
| `docker-compose.yml` | Local development | Bundled mongo:7 container |
| `docker-compose.prod.yml` | EC2 production | MongoDB Atlas via `server/.env` |

---

## Run API + MongoDB with Docker Compose (Local)

An alternative to running MongoDB and the server locally — Docker Compose handles both. The React client still runs locally.

### Start

```bash
docker compose up --build
```

API: `http://localhost:5001` · MongoDB: `localhost:27017`

On first startup the default dev admin is auto-created (`admin@clouddesk.com / admin`).

### Start the React client (separate terminal)

```bash
cd client && npm run dev
```

Vite proxies `/api` to `http://localhost:5001` automatically. Open `http://localhost:5173`.

### Seed demo users inside Docker

```bash
docker compose exec api npm run seed
```

### Create a production-style admin inside Docker

```bash
docker compose exec api \
  sh -c 'ADMIN_NAME="Ops Admin" ADMIN_EMAIL="ops@example.com" ADMIN_PASSWORD="StrongPass123!" npm run create-admin'
```

### Stop

```bash
docker compose down          # stop, keep data
docker compose down -v       # stop and delete MongoDB volume
docker compose logs -f api   # stream API logs
```

See [docs/local-deployment.md](docs/local-deployment.md) for the full local deployment guide including troubleshooting.

---

## Run API on EC2 with Docker Compose (Production)

`docker-compose.prod.yml` runs only the API container. MongoDB runs on Atlas. Config is loaded from `server/.env`.

Create `server/.env` on EC2:

```env
PORT=5001
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/clouddesk?retryWrites=true&w=majority
JWT_SECRET=<output of: openssl rand -hex 32>
NODE_ENV=production
CLIENT_URL=https://<your-cloudfront-domain>.cloudfront.net
```

Then start the container:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs api --tail=20
```

See [docs/aws-deployment-runbook.md](docs/aws-deployment-runbook.md) for the full EC2 deployment sequence.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | API server port (default: 5001) |
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | **Required** | Signs JWT tokens — server will not start without this |
| `CLIENT_URL` | No | Deployed frontend URL — added to CORS allowlist in production |
| `NODE_ENV` | No | Set to `production` in deployed environments |
| `SENTRY_ENABLED` | No | Set to `true` to enable backend Sentry. Default: `false`. |
| `SENTRY_DSN` | If Sentry enabled | Backend Sentry DSN. Never commit. |
| `SENTRY_ENVIRONMENT` | No | Backend Sentry environment tag. Defaults to `NODE_ENV`. |
| `SENTRY_RELEASE` | No | Backend Sentry release tag. Defaults to `clouddesk-api@local`. |

See `server/.env.example` for the template.

**Frontend environment variables** (`client/.env`):

| Variable | Required | Description |
|---|---|---|
| `VITE_SENTRY_ENABLED` | No | Set to `true` to enable frontend Sentry. Default: `false`. |
| `VITE_SENTRY_DSN` | If Sentry enabled | Frontend Sentry DSN. Never commit. |
| `VITE_SENTRY_ENVIRONMENT` | No | Frontend Sentry environment tag. Defaults to Vite `MODE`. |
| `VITE_SENTRY_RELEASE` | No | Frontend Sentry release tag. Defaults to `clouddesk-web@local`. |

See `client/.env.example` for the template.

---

## Security

- **Public registration is locked to `requester` role.** Any `role` field sent in the request body is ignored server-side.
- **Password requirements:** minimum 8 characters, at least one uppercase letter, one lowercase letter, and one number. Enforced server-side on registration.
- **JWT_SECRET is required at startup.** The server refuses to start if it is missing.
- **Helmet** sets security headers on all responses.
- **Rate limiting:** 200 requests / 15 min per IP globally; stricter 20 requests / 15 min on auth endpoints.
- **CORS:** `localhost:5173` always allowed in development. Set `CLIENT_URL` in production to restrict origins.

---

## Monitoring

### Health endpoints

| Endpoint | Status code | Description |
|---|---|---|
| `GET /api/health` | 200 always | Service info, uptime, environment, Sentry status |
| `GET /api/health/live` | 200 always | Liveness — confirms process is running |
| `GET /api/health/ready` | 200 / 503 | Readiness — confirms MongoDB is connected |

```bash
curl http://localhost:5001/api/health
curl http://localhost:5001/api/health/live
curl http://localhost:5001/api/health/ready
```

The `/api/health` endpoint is used as the deploy gate in the GitHub Actions deployment workflow.

### Structured logging

The API uses `pino` and `pino-http` for structured JSON request logging. On EC2, logs are available via Docker Compose:

```bash
docker compose -f docker-compose.prod.yml logs -f api
```

`Authorization` headers and `password` fields are redacted from all log output.

### Sentry (optional — backend)

Backend error tracking via `@sentry/node` is optional and disabled by default. Set `SENTRY_ENABLED=true` and `SENTRY_DSN=<your-dsn>` in `server/.env` on EC2 to enable. Never commit a real DSN.

### Sentry (optional — frontend)

Frontend error tracking via `@sentry/react` is optional and disabled by default. Set `VITE_SENTRY_ENABLED=true` and `VITE_SENTRY_DSN=<your-dsn>` in `client/.env` (locally) or as build-time environment variables in CI/CD.

`Sentry.ErrorBoundary` wraps the app when enabled — unhandled React render errors show a clean fallback rather than a blank page. 5xx API errors and network failures are captured automatically. Auth headers, tokens, passwords, and request bodies are never sent to Sentry.

### System Health dashboard (admin only)

The admin-only `/admin/system-health` page provides a live view of the running application:

- **Status** — API status (ok/degraded), MongoDB connectivity, Sentry state, environment
- **Runtime** — uptime, memory usage, Node.js version, process ID
- **Application data** — user count, ticket counts, KB article counts (live from MongoDB)
- **Request metrics** — total requests, status code groups (2xx/3xx/4xx/5xx), error rate, average and slowest response time
- **Route metrics** — top endpoints by call count with per-route error counts and average response time
- **Recent Application Events** — last 50 sanitized request events (no bodies, headers, or credentials)

In-memory metrics reset on server restart. No secrets are exposed.

See [docs/monitoring-runbook.md](docs/monitoring-runbook.md) for full setup, log commands, and incident response guidance.
See [docs/incident-response-runbook.md](docs/incident-response-runbook.md) for the 14-incident response guide.

### Admin Account Strategy

**Development (automatic on first startup):**

The server auto-creates a default admin on startup when `NODE_ENV !== production`. This runs once — if `admin@clouddesk.com` already exists, it is skipped silently.

```
Email:    admin@clouddesk.com
Password: admin
```

> This is a convenience account with a deliberately weak password. It is never created in production.

**Production (explicit CLI):**

Use the `create-admin` script from the `server/` directory. It requires three environment variables and validates the password before creating the account. Running it again with a different email creates a second admin — each email is independent.

```bash
# Create the first production admin
ADMIN_NAME="Musa Admin" \
ADMIN_EMAIL="admin1@yourdomain.com" \
ADMIN_PASSWORD="StrongPassword123!" \
npm run create-admin

# Create a second admin later
ADMIN_NAME="Operations Admin" \
ADMIN_EMAIL="ops-admin@yourdomain.com" \
ADMIN_PASSWORD="AnotherStrongPassword123!" \
npm run create-admin
```

If `ADMIN_EMAIL` already exists in the database, the script exits with an error and makes no changes.

---

## Production Readiness

Environment validation runs at server startup via `server/src/config/env.ts`. The server refuses to start if `MONGO_URI` or `JWT_SECRET` are missing. In production (`NODE_ENV=production`), the server additionally requires `JWT_SECRET` to be at least 32 characters and `CLIENT_URL` to be set.

Key production behaviours:
- Default dev admin (`admin@clouddesk.com / admin`) is **never created** when `NODE_ENV=production`
- Use `npm run create-admin` (in `server/`) to create the first production admin
- Public registration always creates `requester` accounts — role cannot be set via the API
- Support agents are created by admins at `/admin/support-agents/new`

See [docs/production-readiness-checklist.md](docs/production-readiness-checklist.md) for the full pre-deployment checklist.

---

## CI/CD Deployment

Two GitHub Actions workflows run on this repo:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Pull request to `main` | Validates server + client builds |
| `deploy.yml` | Push to `main` | Validates, then deploys backend to EC2 and frontend to S3 + CloudFront |

On every merge to `main`:
1. Server and client builds are validated — deploy is blocked if either fails
2. Backend: SSH to EC2, `git reset --hard`, upsert Sentry env vars into `server/.env`, rebuild Docker image, health + readiness check
3. Frontend: inject `VITE_SENTRY_*` build-time vars, build React client, `aws s3 sync`, CloudFront invalidation

Eleven GitHub secrets are required — see [docs/cicd-deployment.md](docs/cicd-deployment.md) for the full list, IAM permissions, and troubleshooting guide.

---

## Quality Checks

GitHub Actions validates both builds on pull requests to `main`. The deploy workflow reruns validation on merge.

Run the same checks locally:

```bash
cd server && npm run build
cd client && npm run build
```

---

## API Overview

Base URL: `http://localhost:5001/api`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Register new user | Public |
| POST | `/auth/login` | Login, returns JWT | Public |
| GET | `/users/assignees` | List agents and admins | Agent/Admin |
| POST | `/users/support-agents` | Create support agent account | Admin |
| GET | `/tickets` | List tickets (scoped by role) | Any |
| POST | `/tickets` | Create a ticket | Any |
| GET | `/tickets/:id` | Get ticket detail | Any |
| PATCH | `/tickets/:id/status` | Update ticket status | Agent/Admin |
| POST | `/tickets/:id/comments` | Add comment | Any |
| PATCH | `/tickets/:id/assign` | Assign ticket | Agent/Admin |
| GET | `/kb` | List KB articles | Any |
| GET | `/kb/search` | Search KB articles | Any |
| GET | `/kb/:id` | Get article detail | Any |
| POST | `/kb` | Create article | Agent/Admin |
| PATCH | `/kb/:id` | Update article | Agent/Admin |
| DELETE | `/kb/:id` | Delete article | Admin |
| GET | `/dashboard` | Dashboard metrics | Any |
| GET | `/system/health` | Full system health, metrics, and DB counts | Admin |
| GET | `/system/events` | Recent sanitized application events | Admin |

Full request/response documentation: [docs/api.md](docs/api.md)

---

## Screenshots

> To add screenshots: run the app locally, capture each screen, and save to the `screenshots/` folder.
> See [screenshots/README.md](screenshots/README.md) for the full capture checklist and filenames.

| Screen | Preview |
|---|---|
| Dashboard | ![Dashboard](screenshots/dashboard.png) |
| Ticket List | ![Ticket List](screenshots/tickets-list.png) |
| Ticket Detail | ![Ticket Detail](screenshots/ticket-detail-agent.png) |
| Knowledge Base | ![Knowledge Base](screenshots/kb-list.png) |
| Knowledge Article | ![Article](screenshots/kb-article.png) |

---

## Stage 1 Scope

Stage 1 is a fully functional local MVP. It includes:

- [x] Project scaffold (monorepo, TypeScript, Tailwind)
- [x] Backend authentication (register, login, JWT, bcrypt)
- [x] Backend tickets (CRUD, status, comments, assignment)
- [x] Backend knowledge base (articles, search, publish/draft)
- [x] Backend dashboard (metrics, role-scoped aggregation)
- [x] Frontend authentication (login, register, protected routes, AuthContext)
- [x] Frontend tickets (list, detail, create, status update, assign, comment)
- [x] Frontend knowledge base (list, search, detail, create, edit, delete)
- [x] Frontend dashboard (metric cards, breakdowns, recent tickets)
- [x] Seed script (demo users)
- [x] Documentation (README, architecture, API reference, case study, roadmap)

Stage 1 deliberately excludes AWS deployment, S3, CloudWatch, and ServiceNow integration. Local Docker Compose deployment and GitHub Actions CI are part of the Chapter 2 foundation.

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | System design, auth flow, RBAC, data models, folder structure |
| [API Reference](docs/api.md) | Full endpoint documentation with request/response examples |
| [Local Deployment](docs/local-deployment.md) | Docker Compose setup, troubleshooting, and common commands |
| [CI/CD Deployment](docs/cicd-deployment.md) | GitHub Actions workflows, secrets, rollback steps, troubleshooting |
| [AWS Deployment Runbook](docs/aws-deployment-runbook.md) | Step-by-step EC2 + S3 + CloudFront deployment guide |
| [AWS Cost Control](docs/aws-cost-control.md) | Budget alerts, teardown checklist, cost risk notes |
| [Production Readiness Checklist](docs/production-readiness-checklist.md) | Pre-deployment, security, smoke test, and teardown checklist |
| [Monitoring Runbook](docs/monitoring-runbook.md) | Health checks, structured logging, Sentry setup, System Health dashboard |
| [CloudWatch Logs](docs/cloudwatch-logs.md) | CloudWatch Logs integration guide, required AWS setup, EC2 commands, rollback |
| [Incident Response Runbook](docs/incident-response-runbook.md) | 14-incident response guide: API failures, MongoDB, CloudFront, CORS, Sentry, disk, 5xx errors |
| [Scalability Plan](docs/scalability-plan.md) | Current architecture, limitations, target scalable architecture, and staged migration roadmap |
| [Load Testing Baseline](docs/load-testing-baseline.md) | Test scenarios, results tables, metrics interpretation, and future comparison points |
| [Stage 1 Case Study](docs/stage-1-case-study.md) | Project write-up for portfolio review |
| [Future Roadmap](docs/future-roadmap.md) | Stage 2–4 plans including AWS, monitoring, and ServiceNow mapping |

---

## Future Roadmap

- **Stage 2** — AWS deployment (EC2/ECS, MongoDB Atlas, S3, IAM, Route 53)
- **Stage 3** — Observability (CloudWatch, health checks, error tracking, SLA alerting)
- **Stage 4** — ServiceNow workflow mapping, SLA rules, escalation matrix, email notifications

See [docs/future-roadmap.md](docs/future-roadmap.md) for detail.

---

## Repository Metadata Suggestions

Paste these into the GitHub repository **About** panel (gear icon on the repo homepage).

**Description:**
```
ServiceNow-inspired ITSM support platform with ticketing, RBAC, knowledge base, dashboard metrics, and AWS-ready architecture.
```

**Topics:**
```
react typescript nodejs express mongodb mongoose itsm service-desk ticketing-system rbac aws-ready portfolio-project
```

---

## Licence

MIT — built for portfolio use.
