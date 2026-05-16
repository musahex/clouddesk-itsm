# CloudDesk — Production Readiness Checklist

Work through this checklist before deploying CloudDesk to a production environment. Each section maps to a distinct risk area.

---

## A. Local Validation

Confirm the build and local stack are working before touching any cloud infrastructure.

- [ ] `cd server && npm run build` — TypeScript compiles without errors
- [ ] `cd client && npm run build` — Vite bundle builds without errors
- [ ] `docker compose up --build` — API and MongoDB containers start successfully
- [ ] `curl http://localhost:5001/api/health` returns `{"status":"ok","service":"CloudDesk API"}`
- [ ] GitHub Actions CI (`ci.yml`) is green on the latest PR (both `server` and `client` jobs pass)
- [ ] GitHub Actions Deploy (`deploy.yml`) is configured — all nine secrets are set in repo Settings
- [ ] README is up to date — local setup steps work as documented
- [ ] Screenshots in `screenshots/` are current and match the live app

---

## B. Security Readiness

- [ ] `JWT_SECRET` is a strong random value — at least 32 characters
  - Generate: `openssl rand -hex 32`
  - The server will refuse to start in production if this requirement is not met
- [ ] `JWT_SECRET` is not committed to the repository (check `.gitignore` covers `.env`)
- [ ] `NODE_ENV=production` is set in the production environment
- [ ] `CLIENT_URL` is set to the deployed frontend URL (required in production)
- [ ] Public registration creates `requester` only — any `role` field in the request body is silently ignored by the server
- [ ] Default dev admin (`admin@clouddesk.com / admin`) is NOT created in production — `bootstrapDevAdmin()` checks `env.isProduction` and exits immediately
- [ ] Production admin accounts are created using `npm run create-admin` (not public registration)
- [ ] Support agent accounts are created by an admin via `/admin/support-agents/new` (not public registration)
- [ ] Rate limiting is active — 200 req/15 min globally, 20 req/15 min on `/api/auth`
- [ ] Helmet security headers are active on all responses
- [ ] CORS allowlist is configured correctly — `CLIENT_URL` is the only external origin allowed
- [ ] No `.env` files are committed to the repository

---

## C. Database Readiness

- [ ] MongoDB Atlas cluster is provisioned in the target region
- [ ] Atlas database user created with a strong password and least required permissions (read/write on the `clouddesk` database only)
- [ ] Atlas IP allowlist reviewed — EC2's public IP is added; all other entries are intentional
- [ ] Atlas backups are enabled (M10 and above include automated backups)
- [ ] Production `MONGO_URI` (connection string) is stored securely — not committed to the repo
- [ ] Connection tested from local machine with `mongosh "<connection-string>"`

---

## D. Deployment Readiness

- [ ] Docker Compose local deployment works (`docker compose up --build` + health check)
- [ ] `docs/aws-deployment-runbook.md` has been read and the deployment sequence is understood
- [ ] `docs/aws-cost-control.md` has been read and cost-control steps are in place
- [ ] AWS Budget alert is created before launching any AWS resources
- [ ] AWS Billing alarm is created in CloudWatch (us-east-1)
- [ ] EC2 instance type decided (t3.micro recommended for initial deployment)
- [ ] AWS region decided and consistent across all resources
- [ ] All AWS resources will be tagged `Project=CloudDesk`
- [ ] Teardown plan is understood — see Section F below and `docs/aws-cost-control.md`

---

## E. CI/CD Deployment

- [ ] All nine GitHub Actions secrets are set (see `docs/cicd-deployment.md` for the full list)
- [ ] `EC2_SSH_KEY` contains the full private key — tested with a manual SSH connection first
- [ ] `server/.env` exists on EC2 and contains `NODE_ENV=production`, valid `MONGO_URI`, strong `JWT_SECRET`, and `CLIENT_URL`
- [ ] `git reset --hard` on EC2 does not overwrite `server/.env` (confirm `.env` is in `.gitignore`)
- [ ] IAM user has least-privilege S3 and CloudFront permissions — no `AdministratorAccess`
- [ ] A push to `main` triggers the deploy workflow and both `deploy-backend` and `deploy-frontend` jobs succeed
- [ ] Backend health check passes after deploy: `curl http://localhost:5001/api/health` returns `{"status":"ok"}`
- [ ] CloudFront invalidation completes and the updated React build is visible in the browser

---

## F. Smoke Tests After Deployment

Run through each test immediately after deploying. Repeat after any update.

| # | Test | Role | Expected result |
|---|---|---|---|
| 1 | `GET /api/health` | — | `{"status":"ok","service":"CloudDesk API"}` |
| 2 | Login | admin | Redirected to dashboard, role badge shows Admin |
| 3 | Dashboard metrics | admin | Page loads, metric cards visible (zero counts acceptable) |
| 4 | Create support agent | admin | Navigate to `/admin/support-agents/new`, fill form, success banner appears |
| 5 | Login as new support agent | support_agent | Login works, agent dashboard visible |
| 6 | Register new requester | public | Registration creates requester-role account |
| 7 | Create ticket | requester | Ticket created, appears in Tickets list |
| 8 | Assign ticket | agent/admin | Assignee dropdown populated, assign updates ticket |
| 9 | Update ticket status | agent/admin | Status updates, `resolvedAt` set when status = Resolved |
| 10 | Add internal note | agent | Note visible to agent, not visible when logged in as requester |
| 11 | Create KB article (draft) | agent | Article saved, visible to agent only |
| 12 | Publish KB article | agent | Article now visible to requester |
| 13 | KB search | requester | Published article returned in search results |
| 14 | Dashboard (requester) | requester | Metrics scoped to own tickets only |

---

## G. Rollback and Teardown

### Rollback (broken deployment)

```bash
# On EC2 — roll back to previous commit
docker compose down
git log --oneline -5        # identify last known good commit
git checkout <commit-hash>
docker compose up -d --build
docker compose logs api --tail=20
```

If MongoDB data was affected:
1. Stop the API container
2. Go to MongoDB Atlas → Backup → restore most recent snapshot
3. Restart the API

For the React client (S3 + CloudFront), re-upload the previous build and invalidate the cache:
```bash
aws s3 sync <previous-dist-folder> s3://<bucket> --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

### Teardown (stop billing)

Use the teardown checklist in `docs/aws-cost-control.md`. In summary:

- [ ] Terminate EC2 instance
- [ ] Delete unattached EBS volumes
- [ ] Delete EBS snapshots
- [ ] Release Elastic IPs
- [ ] Empty and delete S3 bucket
- [ ] Disable and delete CloudFront distribution
- [ ] Delete Route 53 records and hosted zone (if created)
- [ ] Pause or terminate MongoDB Atlas cluster
- [ ] Check AWS Cost Explorer the next day for unexpected charges
