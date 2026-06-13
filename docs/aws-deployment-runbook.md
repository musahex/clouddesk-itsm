# CloudDesk — AWS Deployment Runbook

This runbook covers the first production deployment of CloudDesk to AWS. It uses EC2 + Docker Compose for the API (not ECS — see rationale below), MongoDB Atlas for the database, and S3 + CloudFront for the React client.

> **Status:** Planning complete. Not yet deployed. Follow this runbook when ready to deploy.

---

## Target Architecture

```
┌──────────────────────────────────────────────────────┐
│  Users                                               │
└──────────┬───────────────────────────┬───────────────┘
           │ https://clouddesk.example.com              │ https://api.clouddesk.example.com
           ▼                                            ▼
┌──────────────────┐                      ┌────────────────────────┐
│  CloudFront      │                      │  EC2 (t3.micro)        │
│  + S3 Bucket     │                      │  Docker Compose        │
│  React SPA       │                      │  clouddesk-api :5001   │
│  (static build)  │                      │  Security Group        │
└──────────────────┘                      └───────────┬────────────┘
                                                       │ Mongoose
                                          ┌────────────▼────────────┐
                                          │  MongoDB Atlas           │
                                          │  M0 free tier or M10    │
                                          │  Connection string via  │
                                          │  MONGO_URI env var      │
                                          └─────────────────────────┘
```

**DNS/TLS (Phase 2 of deployment):**
Route 53 for DNS, ACM for TLS certificates on CloudFront and the API. For the initial smoke test, use raw EC2 public IP and CloudFront domain before adding custom domains.

**Secrets (Phase 1):**
Production `.env` file on EC2, created manually. Never committed to the repo.

**Secrets (Phase 2):**
Migrate to AWS SSM Parameter Store or Secrets Manager and inject via EC2 user data or an init script.

---

## Why EC2 + Docker Compose First (Not ECS)

| Concern | EC2 + Docker Compose | ECS Fargate |
|---|---|---|
| Conceptual overhead | Low — SSH in, edit, restart | High — task definitions, ECR, IAM roles, service config |
| Demo value | Shows AWS, Linux, Docker, SGs, env vars, logs | Shows DevOps maturity but harder to explain simply |
| Cost | ~$8–10/month (t3.micro, no LB) | Higher — ALB alone ~$16/month |
| Debugging | `docker compose logs`, `docker exec` | CloudWatch Logs, `aws ecs execute-command` |
| Path to ECS | Easy — same Dockerfile, add task definition later | N/A |

ECS Fargate is the right long-term target and is documented in Stage 3. EC2 + Docker Compose gets a working production URL faster and demonstrates the same containerisation skills at lower complexity.

---

## Pre-Deployment Checklist

Before starting, confirm each item:

- [ ] GitHub Actions CI is passing on `main` (both `server` and `client` jobs green)
- [ ] `docker compose up --build` works locally and `curl http://localhost:5001/api/health` returns `{"status":"ok"}`
- [ ] Environment validation passes locally — no startup errors with a valid `.env`
- [ ] `NODE_ENV=production` will be set in the production `.env`
- [ ] `CLIENT_URL` is set to the production frontend URL (required — server refuses to start without it in production)
- [ ] Strong `JWT_SECRET` generated — at least 32 characters (`openssl rand -hex 32`); the server enforces this minimum length in production
- [ ] MongoDB Atlas account created, cluster provisioned, connection string ready
- [ ] AWS account ready, region selected (`us-east-1` — EC2 is in `us-east-1c`)
- [ ] AWS Budget alert created (see `docs/aws-cost-control.md`)
- [ ] Production `.env` values prepared (not committed to repo)
- [ ] Domain name decision made (custom domain or CloudFront/EC2 default URLs for now)
- [ ] Full production readiness checklist reviewed: `docs/production-readiness-checklist.md`

---

## Deployment Sequence

### Step 1 — MongoDB Atlas

1. Create a free M0 cluster (or M10 for production) in the same region as EC2
2. Create a database user with a strong password — note the username and password
3. Add the EC2 public IP to the IP allowlist (update after EC2 launch)
4. Copy the connection string — it looks like:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/clouddesk?retryWrites=true&w=majority
   ```
5. Test the connection from your local machine:
   ```bash
   mongosh "mongodb+srv://..."
   ```

### Step 2 — Prepare production environment variables

Create this file locally (do not commit it):

```env
PORT=5001
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/clouddesk?retryWrites=true&w=majority
JWT_SECRET=<output of: openssl rand -hex 32>
NODE_ENV=production
CLIENT_URL=https://<your-cloudfront-domain>.cloudfront.net
```

`CLIENT_URL` is the React app's origin — used in the server's CORS allowlist. Use the CloudFront domain initially; update to a custom domain later.

### Step 3 — Launch EC2

1. In the AWS Console, go to EC2 → Launch Instance
2. Choose:
   - **AMI:** Amazon Linux 2023 (free tier eligible)
   - **Instance type:** `t3.micro` (free tier eligible for 12 months)
   - **Key pair:** Create a new key pair, download the `.pem` file, store it safely
   - **Storage:** 8 GB gp3 (default)
3. Configure the security group — see Step 4
4. Add a tag: `Project=CloudDesk`
5. Launch and note the public IP

### Step 4 — Security group

| Type | Protocol | Port | Source | Purpose |
|---|---|---|---|---|
| SSH | TCP | 22 | My IP only | Admin access |
| Custom TCP | TCP | 5001 | My IP only (or 0.0.0.0/0 temporarily) | API smoke test |

> After confirming the API works, restrict port 5001 to My IP only. When a reverse proxy (nginx) is added later, remove the 5001 rule entirely and expose only 80/443.

MongoDB Atlas is not publicly accessible via EC2's security group — Atlas uses its own IP allowlist. Never open MongoDB port 27017 on EC2.

### Step 5 — Install Docker on EC2

SSH into the instance:

```bash
ssh -i your-key.pem ec2-user@<EC2-PUBLIC-IP>
```

Install Docker and the Compose plugin:

```bash
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user
newgrp docker

# Docker Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

docker compose version   # confirm
```

### Step 6 — Clone repo and create production .env

```bash
git clone https://github.com/musahex/clouddesk-itsm.git
cd clouddesk-itsm
```

Create the production `.env` inside `server/`:

```bash
nano server/.env
# Paste the values prepared in Step 2, save and exit
```

### Step 7 — Start the API

The repo includes `docker-compose.prod.yml` for production deployments. It runs only the `api` service — MongoDB runs on Atlas, not locally. All config is loaded from `server/.env`.

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs api --tail=30
```

Expected output:
```
clouddesk-api | MongoDB connected
clouddesk-api | CloudDesk API running on http://localhost:5001
```

Note: `bootstrapDevAdmin` is skipped because `NODE_ENV=production` in `server/.env`.

**Useful production commands:**

```bash
# View live logs
docker compose -f docker-compose.prod.yml logs -f api

# Restart after a config change
docker compose -f docker-compose.prod.yml restart api

# Pull latest code and rebuild
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Stop
docker compose -f docker-compose.prod.yml down
```

### Step 8 — Smoke test the API

From your local machine:

```bash
curl http://<EC2-PUBLIC-IP>:5001/api/health
# → {"status":"ok","service":"CloudDesk API","environment":"production",...}

curl http://<EC2-PUBLIC-IP>:5001/api/health/live
# → {"status":"alive",...}

curl http://<EC2-PUBLIC-IP>:5001/api/health/ready
# → {"status":"ready","database":"connected",...}  (200 = MongoDB connected)
# → {"status":"not_ready","database":"disconnected",...}  (503 = MongoDB not connected)
```

The `/api/health/ready` endpoint is the most informative — a 200 response confirms the API process is running **and** MongoDB Atlas is reachable.

### Step 9 — Build and deploy the React client

On your local machine, build with the production API URL:

```bash
cd client
VITE_API_BASE_URL=http://<EC2-PUBLIC-IP>:5001/api npm run build
```

> If the client uses a relative `/api` path with Vite proxy, build normally and configure the CloudFront origin to point to the EC2 API. For a simpler first deploy, set `VITE_API_BASE_URL` as an env var if the client supports it, or update `vite.config.ts` to point to the EC2 URL in production mode.

Upload the build to S3:

```bash
aws s3 sync client/dist s3://<your-bucket-name> --delete
```

### Step 10 — Configure S3 and CloudFront

**S3:**
1. Create a bucket (e.g. `clouddesk-client-prod`) in your region
2. Block all public access (CloudFront will serve it)
3. Upload `client/dist/` contents

**CloudFront:**
1. Create a distribution
2. Origin: the S3 bucket (use OAC — Origin Access Control)
3. Default root object: `index.html`
4. Custom error response: 404 → `/index.html` (status 200) — required for React Router
5. Note the CloudFront domain (e.g. `d1234abcd.cloudfront.net`)
6. Update `CLIENT_URL` in EC2's `.env` to this domain
7. Restart the API container: `docker compose restart api`

### Step 11 — End-to-end smoke test

See the Smoke Test Checklist below.

---

## Smoke Test Checklist

After deployment, run through each item logged in as the appropriate user:

| # | Test | User | Expected |
|---|---|---|---|
| 1 | `GET /api/health` | — | 200 with `"status":"ok"` |
| 1b | `GET /api/health/ready` | — | 200 with `"database":"connected"` |
| 2 | Login | admin | Redirected to dashboard |
| 3 | Dashboard metrics | admin | Loads without error (zero counts acceptable) |
| 4 | Create support agent | admin | Success banner, name/email/role shown |
| 5 | Create ticket | requester | Ticket created, appears in list |
| 6 | Assign ticket | agent/admin | Assignee dropdown populated, assign succeeds |
| 7 | Update ticket status | agent/admin | Status updates, `resolvedAt` set on Resolved |
| 8 | Add internal note | agent | Note visible to agent, hidden from requester |
| 9 | Create KB article | agent | Article saved as draft |
| 10 | Publish KB article | agent | Article visible to requester |
| 11 | KB search | requester | Published article returned in results |
| 12 | Dashboard (requester) | requester | Scoped to own tickets only |

---

## Monitoring After Deployment

### View live logs

```bash
# On EC2
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs api --tail=100
```

Logs are structured JSON. Each line includes the HTTP method, URL, status code, and response time. `Authorization` headers and passwords are redacted automatically.

### Enable Sentry (optional)

Add to `server/.env` on EC2:

```env
SENTRY_ENABLED=true
SENTRY_DSN=https://your-dsn@sentry.io/123456
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=clouddesk-api@1.0.0
```

Restart the container:

```bash
docker compose -f docker-compose.prod.yml restart api
```

Verify:

```bash
curl http://localhost:5001/api/health
# "sentryEnabled": true  confirms Sentry is active
```

See [docs/monitoring-runbook.md](monitoring-runbook.md) for full monitoring guidance and incident response.

---

## Rollback Plan

If the deployment is broken and needs to be reverted:

```bash
# On EC2
docker compose down

# Roll back to previous commit
git log --oneline -5      # find the last good commit hash
git checkout <hash>

# Rebuild and restart
docker compose up -d --build
docker compose logs api --tail=20
```

If the database was corrupted or a migration went wrong:

1. Stop the API container
2. Go to MongoDB Atlas → Backup
3. Restore from the most recent snapshot
4. Restart the API

For the React client, re-upload the previous build to S3 and invalidate the CloudFront cache:

```bash
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

---

## Optional: Enable CloudWatch Logs

CloudDesk is pre-configured to ship Docker logs to CloudWatch Logs via an optional Compose override file. This step is not required for the initial deployment — complete it after the core stack is running and verified.

See `docs/cloudwatch-logs.md` for the full setup guide. Summary:

**1. Create the log group with retention:**

```bash
aws logs create-log-group --log-group-name /clouddesk/api --region us-east-1
aws logs put-retention-policy --log-group-name /clouddesk/api --retention-in-days 14 --region us-east-1
```

**2. Attach IAM permissions to the EC2 instance role:**

Required actions on the log group ARN: `logs:CreateLogStream`, `logs:PutLogEvents`, `logs:DescribeLogStreams`, `logs:DescribeLogGroups`.

**3. Enable the override and restart:**

```bash
AWS_REGION=us-east-1 \
CLOUDWATCH_LOG_GROUP=/clouddesk/api \
CLOUDWATCH_LOG_STREAM_PREFIX=api \
docker compose -f docker-compose.prod.yml -f docker-compose.cloudwatch.yml up -d --build
```

**4. Verify logs are arriving:**

```bash
curl http://localhost:5001/api/health/ready
aws logs filter-log-events --log-group-name /clouddesk/api --region us-east-1 --limit 10
```

**Rollback** (return to Docker stdout logging):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Teardown Plan

To shut down all AWS resources and stop incurring costs:

1. **EC2:** Stop instance (keeps EBS volume, billed at lower rate). Terminate instance to delete it.
2. **EBS volumes:** After termination, check EC2 → Volumes for any unattached volumes and delete them.
3. **S3:** Empty the bucket (`aws s3 rm s3://<bucket> --recursive`), then delete the bucket.
4. **CloudFront:** Disable the distribution first (takes ~15 min), then delete it.
5. **Route 53:** Delete A/CNAME records and the hosted zone if not being reused (hosted zones cost ~$0.50/month).
6. **Elastic IP:** If you allocated one, release it immediately after EC2 termination — unused Elastic IPs are billed.
7. **MongoDB Atlas:** Pause or delete the cluster from the Atlas console.

After teardown, verify in AWS Cost Explorer that no unexpected charges appear over the next 1–2 days.

See `docs/aws-cost-control.md` for full cost-control and cleanup guidance.
