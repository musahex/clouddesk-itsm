# CloudDesk — Scalability Plan

## 1. Purpose

CloudDesk currently runs as a portfolio-grade, production-like deployment on a single EC2 instance. It serves real traffic, deploys automatically via GitHub Actions, and is monitored through Sentry and the admin System Health dashboard.

This document explains:
- what the current architecture looks like and why it works for a portfolio deployment
- what is already built in a scale-friendly way
- where the current architecture has a hard ceiling
- what the target scalable architecture looks like
- a concrete migration roadmap from here to there
- a checklist of what is done and what remains

The goal is honest, progressive thinking — not overclaiming what a portfolio deployment can do today, but demonstrating the understanding and planning that would be required to take it further.

---

## 2. Current Architecture

CloudDesk is a single-region, single-instance deployment on AWS. CloudFront is the public entry point for all traffic. Static frontend assets are served from S3 with CDN caching. API calls are routed through CloudFront to a single EC2 instance running the Express API inside Docker Compose. The database is MongoDB Atlas, an externally managed service.

```
Browser
  ↓
CloudFront
  ├── Default (*) → S3 React Frontend
  └── /api/* → EC2:5001 Docker Compose API
                    ↓
              MongoDB Atlas
```

**Component summary:**

| Component | Current implementation |
|---|---|
| Frontend hosting | S3 bucket + CloudFront CDN distribution |
| API server | Single EC2 instance, Docker Compose, Express on port 5001 |
| Database | MongoDB Atlas (external managed cluster) |
| Container image | Built directly on EC2 at deploy time (`docker compose up --build`) |
| Secrets | `server/.env` on EC2 — manually maintained; Sentry keys upserted by CI/CD |
| Deployment | GitHub Actions SSH deploy to EC2, S3 sync, CloudFront invalidation |
| Monitoring | pino structured logs (EC2/Docker), Sentry (backend + frontend), System Health dashboard |

---

## 3. Current Strengths

Several architectural decisions made early in the project are already aligned with horizontal scaling. These do not need to change when moving to a multi-instance or managed-container deployment.

**Stateless API design**

The Express API holds no per-request or per-session state on the server. All authentication is carried in JWT tokens signed by `JWT_SECRET` and verified on every request. Any instance of the API can handle any request from any user — there is no sticky session requirement.

**External managed database**

MongoDB Atlas is fully external to the EC2 instance. Multiple application servers can connect to the same Atlas cluster without coordination. Atlas handles connection pooling, backups, and availability independently of the application tier.

**Dockerised backend**

`server/Dockerfile` already exists and builds a production-ready Node 20 Alpine image. Docker Compose is the current runtime, but the same image can be pushed to ECR and run on ECS Fargate without changes to the application code.

**Health and readiness endpoints**

`GET /api/health/live` and `GET /api/health/ready` are purpose-built for orchestrators and load balancers. They return simple JSON payloads with correct HTTP status codes (200 for healthy, 503 for not-ready). These are exactly what ALB target group health checks and ECS task health monitoring require.

**Graceful shutdown**

`SIGTERM` and `SIGINT` handlers close the HTTP server and MongoDB connection cleanly before exiting. ECS sends `SIGTERM` before forcibly stopping a container — the current shutdown logic handles this correctly.

**Structured logging**

pino outputs newline-delimited JSON to stdout/stderr. Docker captures this and makes it available via `docker logs`. The same log stream can be shipped to CloudWatch Logs without changing the application — only the Docker log driver configuration needs to change.

**CI/CD build validation**

Every push to `main` runs `npm run build` for both server and client before deploying. Build failures block the deploy. This gate remains valid regardless of whether the deployment target is a single EC2 instance or an ECS service.

**Frontend fully decoupled**

The React SPA is built at deploy time and served entirely from S3 + CloudFront. It has no runtime dependency on the EC2 instance. Frontend scaling (CDN edge caching, geographic distribution) is already handled by CloudFront.

---

## 4. Current Limitations

These are the specific constraints that prevent the current deployment from scaling horizontally or recovering gracefully from instance failure.

**Single point of failure**

One EC2 instance runs the entire API. If the instance is stopped, terminated, or unhealthy, the API is unavailable. CloudFront returns 504 until the container is restarted. There is no automatic failover.

**No Application Load Balancer**

CloudFront's `/api/*` origin points directly to the EC2 public IP on port 5001. There is no health-checked routing layer between CloudFront and the API. If the instance IP changes (e.g. after a restart without an Elastic IP), the CloudFront origin must be updated manually.

**No autoscaling**

Capacity is fixed at one instance. There is no mechanism to add or remove instances in response to load. A traffic spike that exceeds the instance's capacity will cause degraded response times or errors with no automatic remediation.

**No ECS/Fargate or container orchestration**

Containers are managed by Docker Compose directly on the EC2 instance. There is no task placement, restart policy enforcement by an orchestrator, or rolling deployment support. A deploy with a bad image requires manual SSH intervention to roll back.

**No ECR image registry**

The Docker image is built on the EC2 instance from source code on every deploy (`docker compose up --build`). There is no immutable image registry. If a build fails on EC2 mid-deploy, the running container may be stopped with no fallback image available. Build failures on EC2 are also harder to diagnose than build failures in a CI environment.

**In-memory rate limiting**

`express-rate-limit` uses an in-process memory store by default. If two API instances run behind a load balancer, each maintains its own independent counter per IP. A single IP can make 200 requests per window to each instance — effectively multiplying the allowed rate by the number of instances. For correct rate limiting across multiple instances, a shared external store (e.g. Redis) is required.

**In-memory metrics and events**

The System Health dashboard metrics and recent application events are stored in process memory. They reset on every server restart or deploy. In a multi-instance deployment, each instance would have its own independent metrics — the admin dashboard would show only one instance's view at a time.

**Log persistence**

pino logs go to Docker stdout. They are visible via `docker compose logs api` while the container is running on the current EC2 instance. They are lost if the container is replaced, the instance is restarted, or the instance is terminated. There is currently no CloudWatch Logs agent or Docker `awslogs` log driver configured.

**No managed secrets store**

Runtime secrets (`MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`) are stored in `server/.env` on the EC2 instance. This file must be created manually on first setup and maintained by hand. It is not version-controlled (correctly), but it also cannot be rotated, audited, or distributed automatically. A managed secrets store (SSM Parameter Store or Secrets Manager) would allow secrets to be injected at runtime without SSH access to the instance.

**No staging environment**

Every push to `main` deploys directly to the production environment. There is no intermediate environment where changes can be validated before they affect live traffic. A deploy that breaks the API goes immediately to production and must be rolled back via SSH or a manual git revert + redeploy.

**No deploy approval gate**

The `deploy.yml` workflow deploys automatically on every push to `main` with no human approval step. This is appropriate for a portfolio project but not for a team environment where changes require review before production impact.

---

## 5. Target Scalable Architecture

The following architecture replaces the single-EC2 deployment with a managed, horizontally-scalable setup that can handle instance failure, traffic spikes, and rolling deployments without manual intervention.

```
Browser
  ↓
CloudFront
  ├── Default (*) → S3 React Frontend
  └── /api/* → Application Load Balancer
                    ↓
             ECS Fargate Service
             ├── API Task 1 (container)
             ├── API Task 2 (container)
             └── API Task N (autoscaled)
                    ↓
             MongoDB Atlas
```

**Component summary:**

| Component | Target implementation |
|---|---|
| Frontend hosting | S3 + CloudFront — no change |
| API server | ECS Fargate service, multiple tasks behind ALB |
| Container image | ECR — immutable images built in CI, tagged by git SHA |
| Load balancing | Application Load Balancer with `/api/health/ready` health checks |
| Autoscaling | ECS Service Auto Scaling (target tracking on CPU/request count) |
| Database | MongoDB Atlas — no change |
| Secrets | SSM Parameter Store or Secrets Manager — injected at task start |
| Logs | CloudWatch Logs via Docker `awslogs` log driver |
| Alarms | CloudWatch Alarms for 5xx rate, CPU, memory |
| Rate limiting | Redis/shared store replacing the in-memory express-rate-limit store |
| Deployment | GitHub Actions build image → push to ECR → update ECS service (rolling deploy) |

**Key architectural properties of this target state:**

- **Fault tolerance:** ALB health checks route traffic away from unhealthy tasks automatically. ECS replaces stopped tasks without manual intervention.
- **Rolling deploys:** A new image can be deployed task-by-task. Old tasks handle live traffic while new tasks start, pass health checks, and join the target group. A failed new image never takes 100% of traffic.
- **Autoscaling:** ECS scales the number of running tasks up and down based on defined policies. CloudFront + ALB absorb traffic spikes; the API tier adds capacity to match.
- **Immutable images:** Each deploy produces a uniquely-tagged Docker image stored in ECR. Rolling back means pointing the ECS task definition at the previous image tag — no rebuild required.
- **Durable secrets:** Secrets are stored in SSM Parameter Store or Secrets Manager and injected into the ECS task environment at start. No `.env` file to manage on any server.
- **Centralised logs:** All task stdout is shipped to CloudWatch Logs in real time. Logs survive task and instance replacement. Log Insights queries can search across all tasks simultaneously.

---

## 6. Migration Roadmap

Migration is broken into four stages. Each stage delivers value independently and can be stopped at any point. Stages A and B can be done at low cost within the existing portfolio budget. Stages C and D involve higher ongoing AWS spend and should be started only when the learning goal or career context justifies it.

### Stage A — Low-Cost Hardening on Current EC2

**Goal:** Improve the resilience and observability of the current single-instance deployment without adding billable infrastructure.

- Add Nginx as a reverse proxy in front of the Express API container. Nginx listens on port 80 and proxies to port 5001 internally. Direct access to port 5001 from outside the instance is removed from the EC2 security group.
- Configure the Docker `awslogs` log driver in `docker-compose.prod.yml` to ship container logs to CloudWatch Logs. Add the required IAM instance role (`logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`).
- Create CloudWatch Alarms for EC2 CPU utilisation (>80%) and disk usage (>80%). Configure SNS email notification.
- Assign an Elastic IP to the EC2 instance so the public IP does not change on restart, removing the need to update the Atlas allowlist and CloudFront origin after every instance restart.
- Document the MongoDB indexes needed for the most frequent query patterns (ticket status filter, requester filter, KB `isPublished` filter) and apply them.

**What does not change:** Application code, Docker Compose, CI/CD workflow, CloudFront, S3.

**Estimated cost change:** CloudWatch log storage and alarm costs are minimal at this scale (well within free tier for low-traffic portfolios). Elastic IP is free while attached to a running instance.

### Stage B — Container Registry (ECR)

**Goal:** Decouple image build from the EC2 instance. Produce immutable, versioned images that can be deployed to any container environment.

- Add a `docker build` and `docker push` step to the `deploy-backend` job in `deploy.yml`. The runner builds the server image, tags it with the git SHA, and pushes it to an ECR repository.
- Update the EC2 Docker Compose deploy step to pull the new image tag from ECR rather than running `docker compose up --build` locally.
- Update the EC2 IAM instance role with `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, and `ecr:GetDownloadUrlForLayer` permissions.
- Add image lifecycle rules to the ECR repository to automatically expire old images and control storage costs.

**What does not change:** EC2 instance, Docker Compose runtime, CI/CD overall structure, application code.

**Benefits unlocked by this stage:** Rollback by SHA tag without a rebuild. Build failures are caught in CI, not on the production server. EC2 deploys faster (pull pre-built image rather than compile TypeScript + build Docker layer cache from scratch).

**Estimated cost change:** ECR storage is billed at $0.10/GB/month. A Node Alpine image is typically under 200MB. Negligible cost at this scale.

### Stage C — ECS/Fargate Migration

**Goal:** Remove the single-instance constraint. Run the API as managed containers behind an Application Load Balancer with automatic health checks, rolling deploys, and optional autoscaling.

1. Create an ECS cluster (Fargate launch type — no EC2 instances to manage).
2. Create an ECR repository if not done in Stage B.
3. Create an ECS task definition referencing the ECR image, with container environment variables sourced from SSM Parameter Store or Secrets Manager. Remove dependency on `server/.env`.
4. Create an Application Load Balancer with an HTTPS listener (ACM certificate) and a target group pointing to the ECS service. Configure the target group health check to use `GET /api/health/ready` — the existing readiness endpoint.
5. Update the `deploy-backend` CI/CD job to push a new image to ECR and trigger an ECS service update (rolling deployment) rather than SSH-deploying to EC2.
6. Update the CloudFront `/api/*` origin from the EC2 IP to the ALB DNS name. Remove the EC2 origin.
7. Configure ECS Service Auto Scaling with a target tracking policy (e.g. target 60% CPU utilisation, minimum 1 task, maximum N tasks).
8. Decommission or stop the EC2 instance once the ECS service is validated.

**Critical dependency on existing code:** The health endpoints `GET /api/health/live` and `GET /api/health/ready` are already implemented and return the correct HTTP status codes. No application code changes are required for ALB/ECS health check integration. The graceful shutdown (`SIGTERM` handler) is already implemented and compatible with ECS task termination.

**What must change before this stage:**
- Rate limiting must move to a Redis-backed store. The in-memory store will give inconsistent results across multiple tasks.
- Sentry environment variables must move to SSM Parameter Store or Secrets Manager. The Python upsert into `server/.env` is an EC2-specific pattern.

**Estimated cost change:** ALB costs approximately $16–$22/month (LCU charges vary by traffic). Fargate task costs depend on vCPU/memory allocation and number of running tasks. At minimum (1 task, 0.25 vCPU, 512MB), Fargate is roughly $10–$15/month in ap-southeast-2. For a portfolio project, keeping minimum task count at 1 and disabling autoscaling scale-out keeps costs predictable.

### Stage D — Production Observability

**Goal:** Establish the observability layer expected of a production service — centralised logs, dashboards, and alerting.

- Create CloudWatch dashboards for API request rate, 5xx error rate, ECS CPU/memory per task, ALB target response time, and database connection pool usage.
- Create CloudWatch Alarms: 5xx error rate > 1% (5-minute window), ECS task CPU > 80%, ALB unhealthy host count > 0. Route alarms to SNS → email.
- Configure CloudWatch Log Insights saved queries for common incident diagnostics (e.g. filter pino logs for `level:50` errors, find slow requests above a threshold).
- Configure log retention policies on CloudWatch Log Groups (e.g. 30 days for application logs, 90 days for access logs).
- Integrate Sentry releases with the ECS deploy step — set `SENTRY_RELEASE` to the git SHA on deploy so Sentry can correlate errors with specific deploys.
- Document the complete incident response workflow using CloudWatch Logs Insights + Sentry as primary diagnostic tools.

---

## 7. Backend Scale-Readiness Notes

This section identifies the specific code and configuration points that need attention before or during Stage C.

**Already scale-ready:**

- Stateless JWT authentication — any API instance can verify any token
- MongoDB Atlas external cluster — scales independently of the API tier; Mongoose connection pooling handles concurrent instances
- Health/readiness endpoints — correct HTTP status codes, no side effects, safe to poll at high frequency
- Graceful SIGTERM shutdown — compatible with ECS task draining and ALB connection draining
- Pino JSON logging — stdout output is trivially shippable to CloudWatch Logs via any log driver

**Must change before multi-instance deployment:**

| Item | Current state | Required change |
|---|---|---|
| Rate limiting | `express-rate-limit` with default in-memory store | Replace with Redis-backed store (e.g. `ioredis` + `rate-limit-redis`). Redis can be AWS ElastiCache or a small EC2/container instance. Fall back to memory store when Redis is unavailable so the app starts cleanly. |
| System Health metrics | In-process module-level state in `metrics.ts` | Per-instance metrics are still useful locally. For cross-instance aggregation, metrics would need to be shipped to CloudWatch Metrics or an external time-series store. For Phase 7, accepting per-instance metrics is a pragmatic starting point. |
| Recent Application Events | In-process ring buffer in `events.ts` | Per-instance events buffer is acceptable for a developer dashboard. For a unified view across instances, events would need to go to CloudWatch Logs and be queried from there. |
| `server/.env` secrets | File on EC2 instance, manually maintained + CI/CD upsert | SSM Parameter Store or Secrets Manager. ECS task definition references parameters by ARN — no `.env` file on any server. |
| MongoDB query performance | No explicit compound indexes beyond `email` unique index | Add indexes for common query patterns before load increases. Key candidates: `Ticket` on `{ requester: 1 }`, `{ status: 1 }`, `{ status: 1, priority: 1 }`; `KnowledgeArticle` on `{ isPublished: 1 }`, `{ isPublished: 1, category: 1 }`. |

---

## 8. Scale-Readiness Checklist

**Complete:**

- [x] Stateless API design — no server-side session state
- [x] External managed database — MongoDB Atlas, independent of API tier
- [x] Dockerised backend — `Dockerfile` builds a production-ready image
- [x] Health endpoint (`GET /api/health`) — service info and uptime
- [x] Liveness endpoint (`GET /api/health/live`) — ALB/orchestrator liveness probe
- [x] Readiness endpoint (`GET /api/health/ready`) — ALB/ECS health check target
- [x] Graceful shutdown — SIGTERM/SIGINT handlers close server and DB connection cleanly
- [x] CI/CD build validation — both server and client builds validated before deploy
- [x] Sentry backend monitoring — error tracking with release tagging
- [x] Sentry frontend monitoring — unhandled error and 5xx capture
- [x] Structured JSON logging — pino stdout, ready for log driver shipping
- [x] Structured log redaction — Authorization headers and passwords redacted

**Not yet complete:**

- [x] Redis-ready rate limiting with in-memory fallback — `REDIS_URL` optional; falls back to per-process store when unset; distributed store active when Redis is available (Phase 7.2)
- [x] MongoDB indexes applied — compound indexes for common Ticket and KnowledgeArticle query patterns (Phase 7.2)
- [ ] Application Load Balancer in front of API (Stage C)
- [ ] ECS/Fargate or multi-instance API deployment (Stage C)
- [ ] ECR image registry — immutable versioned images (Stage B/C)
- [ ] CloudWatch Logs shipping — durable, centralised log storage (Stage A/D)
- [ ] CloudWatch Alarms — CPU, 5xx rate, unhealthy host count (Stage A/D)
- [ ] Managed secrets store — SSM Parameter Store or Secrets Manager (Stage C)
- [ ] Staging environment — pre-production validation before production deploy
- [ ] Deploy approval gate — human review step before production
- [ ] Load testing baseline — measured performance characteristics under load

---

## 9. Cost-Control Notes

**Current cost profile:**

The current EC2 + S3 + CloudFront + Atlas Free Tier deployment runs at approximately $5–$20/month depending on instance type, Atlas tier, and data transfer. This is appropriate for a portfolio project that needs to demonstrate a real production-like deployment without a significant ongoing spend.

**Cost implications of each migration stage:**

| Stage | Approximate monthly cost increase |
|---|---|
| Stage A (Nginx, CloudWatch Logs, Elastic IP) | < $5/month — mostly free tier |
| Stage B (ECR) | < $2/month — image storage at $0.10/GB |
| Stage C (ALB + ECS Fargate) | +$25–$40/month — ALB fixed cost + Fargate task hours |
| Stage D (CloudWatch dashboards + alarms) | +$3–$10/month depending on metrics volume |

**Recommendations:**

- Do not create ALB, ECS, or Fargate resources unless the learning goal or an active job application context justifies the cost. These are billable even when idle.
- Stages A and B can be completed within the existing budget.
- For Stage C, set ECS minimum task count to 1 and disable scale-out autoscaling to keep Fargate costs predictable. Scale-out autoscaling can be demonstrated in documentation and architecture diagrams without running it continuously.
- Keep AWS Billing Alerts active (see `docs/aws-cost-control.md`). Set a monthly budget alarm before starting Stage C.
- Tear down ECS services, ALB, and ElastiCache when not actively demonstrating them. These resources do not need to run continuously for portfolio purposes.
- MongoDB Atlas M0 (free tier) is sufficient for portfolio use. Do not upgrade to M10+ unless sustained traffic or backup requirements justify it.
- The S3 + CloudFront frontend and MongoDB Atlas (M0) can remain running indefinitely at near-zero cost regardless of which backend infrastructure stage is active.

---

## 10. Employer-Facing Summary

This scalability plan demonstrates several competencies that are relevant to infrastructure, platform, and application support engineering roles.

**Cloud architecture thinking**

The plan moves from a specific current state (single-instance Docker Compose on EC2) to a specific target state (ECS Fargate behind ALB with CloudWatch observability) with a concrete, staged migration path. Each stage delivers value independently — the architecture does not require a big-bang rewrite.

**Identifying current limitations honestly**

The plan does not overstate what the current deployment can do. Single-instance rate limiting, ephemeral in-memory metrics, log persistence, and the absence of an ALB are all identified explicitly as limitations with clear explanations of why they matter at scale.

**Understanding horizontal scaling**

The plan identifies which components are already scale-friendly (stateless JWT auth, external Atlas, Dockerfile, health endpoints) and which need changes before horizontal scaling works correctly (rate limiting, secrets management, metrics aggregation). This is the kind of analysis that distinguishes engineers who understand distributed systems from those who only know how to deploy a single server.

**Cost and performance trade-offs**

The roadmap stages are ordered by cost impact, not just technical complexity. Stage A delivers observability hardening at near-zero cost. Stage C (ECS/Fargate) is flagged as a deliberate investment decision, not a default next step. Tear-down guidance is included.

**Production-readiness mindset**

The checklist format mirrors production readiness reviews used in engineering teams. The health endpoint design, graceful shutdown implementation, log redaction, and RBAC-gated admin dashboard all reflect an application support and platform reliability perspective — not just a "make it run" approach.

**Portfolio positioning**

CloudDesk is a portfolio-grade single-instance deployment today. This plan shows the understanding required to take it to production scale: what would need to change, in what order, at what cost, and why. For roles in cloud infrastructure, application support, platform engineering, or junior SRE, this kind of thinking is more valuable than a large running AWS bill.
