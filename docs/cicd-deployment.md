# CloudDesk — CI/CD Deployment

This document covers the GitHub Actions pipelines that validate and deploy CloudDesk on every push to `main`.

---

## Architecture

```
Developer pushes to main
         │
         ▼
┌─────────────────────────────────────────────┐
│  .github/workflows/deploy.yml               │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  validate (blocks both deploys)     │    │
│  │  · Server: npm ci + npm run build   │    │
│  │  · Client: npm ci + npm run build   │    │
│  └──────────────┬──────────────────────┘    │
│                 │ needs: validate            │
│       ┌─────────┴─────────┐                 │
│       ▼                   ▼                 │
│  deploy-backend    deploy-frontend           │
│  (parallel)        (parallel)               │
│       │                   │                 │
│       │ SSH               │ aws s3 sync     │
│       ▼                   ▼ + CF invalidate │
│  EC2 Instance        S3 + CloudFront        │
└─────────────────────────────────────────────┘

Pull requests → .github/workflows/ci.yml (validate only, no deploy)
```

**Two workflows, two triggers:**

| Workflow | Trigger | Jobs |
|---|---|---|
| `ci.yml` | Pull request to `main` | `server` build, `client` build |
| `deploy.yml` | Push to `main` (merge) | `validate` → `deploy-backend` + `deploy-frontend` |

---

## GitHub Secrets Required

Configure all of the following in **GitHub → Settings → Secrets and variables → Actions**:

### Backend deployment secrets

| Secret | Description | Example |
|---|---|---|
| `EC2_HOST` | EC2 public IP or hostname | `13.210.xxx.xxx` |
| `EC2_USER` | SSH username for EC2 | `ec2-user` |
| `EC2_SSH_KEY` | Full contents of the EC2 private key `.pem` file | `-----BEGIN RSA PRIVATE KEY-----\n...` |
| `EC2_APP_DIR` | Absolute path to the repo on EC2 | `/home/ec2-user/clouddesk-itsm` |

### Frontend deployment secrets

| Secret | Description | Example |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user access key ID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret access key | `wJalrXUtnFEMI/K7MDENG/...` |
| `AWS_REGION` | AWS region of the S3 bucket | `ap-southeast-2` |
| `S3_BUCKET` | S3 bucket name (no `s3://` prefix) | `clouddesk-client-prod` |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID | `E1ABCD2EFGH3IJ` |

### IAM permissions required for the AWS credentials

The IAM user behind `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::clouddesk-client-prod",
        "arn:aws:s3:::clouddesk-client-prod/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>"
    }
  ]
}
```

---

## What Happens on Push to `main`

1. **`validate` job** — checks out the repo, installs dependencies, and runs `npm run build` for both server and client. If either build fails, both deploy jobs are cancelled automatically.

2. **`deploy-backend` and `deploy-frontend` run in parallel** after `validate` passes.

### Backend deployment flow

1. The runner writes the EC2 private key to `/tmp/deploy_key` and sets permissions `600`
2. SSH connects to `EC2_HOST` using `EC2_USER` and the private key
3. On EC2, inside `EC2_APP_DIR`:
   - `git fetch origin main` — fetches the latest commit
   - `git reset --hard origin/main` — overwrites local files with the latest (never touches `server/.env`)
   - `docker compose -f docker-compose.prod.yml up -d --build` — rebuilds the image and restarts the container
   - `docker image prune -f` — removes dangling images to keep disk usage low
   - `curl -f http://localhost:5001/api/health` — verifies the API started correctly; fails the job if it returns a non-2xx status
4. The private key is deleted from the runner

**The production `server/.env` on EC2 is never overwritten.** `git reset --hard` only affects tracked files — `.env` is in `.gitignore` and is not a tracked file.

### Frontend deployment flow

1. The runner checks out the repo and runs `npm ci && npm run build` in `client/`
2. AWS credentials are configured from secrets using `aws-actions/configure-aws-credentials@v4`
3. `aws s3 sync client/dist s3://<S3_BUCKET> --delete` — uploads the new build and removes stale files
4. `aws cloudfront create-invalidation --paths "/*"` — clears the CDN cache so users immediately get the new build

---

## Rollback Steps

### Backend rollback

If the new backend is broken:

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@<EC2-HOST>
cd <EC2_APP_DIR>

# Find the last known good commit
git log --oneline -5

# Roll back to it
git reset --hard <commit-hash>
docker compose -f docker-compose.prod.yml up -d --build
curl -f http://localhost:5001/api/health
```

Alternatively, revert the commit on GitHub — the next push to `main` will re-deploy automatically.

### Frontend rollback

Upload a previous build from your local machine:

```bash
# Rebuild the previous version locally (after checking out the old commit)
git checkout <commit-hash>
cd client && npm ci && npm run build

# Upload to S3 and invalidate
aws s3 sync client/dist s3://<S3_BUCKET> --delete
aws cloudfront create-invalidation \
  --distribution-id <CLOUDFRONT_DISTRIBUTION_ID> \
  --paths "/*"
```

---

## Troubleshooting

### SSH permission denied

- Confirm `EC2_USER` is correct (`ec2-user` for Amazon Linux)
- Confirm `EC2_SSH_KEY` contains the full private key including header/footer lines
- Confirm the `.pem` key corresponds to the key pair attached to the EC2 instance
- Confirm the EC2 security group allows TCP port 22 from GitHub Actions runner IPs (or `0.0.0.0/0` temporarily to diagnose)

Check by testing SSH manually from your local machine:
```bash
ssh -i your-key.pem ec2-user@<EC2_HOST>
```

### EC2 health check failed

The `curl -f http://localhost:5001/api/health` step failed. Diagnose:

```bash
# SSH into EC2
docker compose -f docker-compose.prod.yml logs api --tail=50
```

Common causes:
- `server/.env` missing `MONGO_URI`, `JWT_SECRET`, or `CLIENT_URL` — env validation throws at startup
- MongoDB Atlas IP allowlist does not include the EC2 public IP
- `JWT_SECRET` is less than 32 characters (production requirement)
- Docker build failed — check logs for TypeScript errors

### S3 sync failed

- Confirm `S3_BUCKET` secret matches the exact bucket name (no `s3://` prefix)
- Confirm the IAM user has `s3:PutObject`, `s3:DeleteObject`, and `s3:ListBucket` permissions on the bucket
- Confirm `AWS_REGION` matches the region where the bucket was created

### CloudFront invalidation failed

- Confirm `CLOUDFRONT_DISTRIBUTION_ID` is the distribution ID (not the domain name)
- Confirm the IAM user has `cloudfront:CreateInvalidation` permission on the distribution ARN
- Note: CloudFront distributions can only be in `us-east-1` for ACM certificates, but invalidation API calls always use the distribution ID regardless of region

### GitHub Actions secret missing

If a secret is not set, the step that references it will either silently use an empty string (for non-critical values) or fail with an authentication error. Check:

- **GitHub → repo → Settings → Secrets and variables → Actions**
- Confirm all nine secrets listed above are present
- Secret names are case-sensitive — `EC2_HOST` is not the same as `ec2_host`
- After adding or updating a secret, re-run the workflow from the Actions tab
