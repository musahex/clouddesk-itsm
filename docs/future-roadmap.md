# CloudDesk — Future Roadmap

Stage 1 is a fully functional local MVP. This document outlines the planned progression through Stage 4.

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

- Dockerise the Express API (`Dockerfile` + `docker-compose` for local parity)
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

### Observability

- **CloudWatch Logs** — Structured API request/error logging via a logging middleware (Winston or Pino)
- **CloudWatch Metrics** — Custom metrics for ticket creation rate, open ticket count, API error rate
- **Health check endpoint** — `/api/health` already exists; extend to report MongoDB connection status
- **SLA alerting** — CloudWatch Alarm when unresolved Critical tickets exceed a configurable threshold
- **Dashboard enhancements** — Average resolution time, SLA compliance rate

### File Attachments

- **S3 upload** — Presigned URL pattern: client requests upload URL from API, uploads directly to S3
- **Ticket attachments** — Attach files (screenshots, logs) to tickets; store S3 object keys on Ticket document
- **IAM** — API has `s3:PutObject` and `s3:GetObject` on the attachments bucket; no public access

### CI/CD

- **GitHub Actions** — Run `tsc --noEmit` and `eslint` on pull requests
- **Deploy on merge to main** — Build Docker image, push to ECR, update ECS service
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
