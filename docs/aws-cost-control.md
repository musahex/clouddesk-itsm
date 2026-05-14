# CloudDesk — AWS Cost Control

This document covers how to deploy CloudDesk on AWS without unexpected charges. Read it before creating any AWS resources.

> **Rule of thumb:** if you can't explain why a resource is running, stop it.

---

## Before You Deploy

### 1. Use the AWS Pricing Calculator

Estimate costs before launching anything:
- Go to [calculator.aws](https://calculator.aws)
- Add EC2 (t3.micro, on-demand, ap-southeast-2 or your region)
- Add S3 (small storage, minimal requests)
- Add CloudFront (minimal data transfer for a portfolio project)
- Confirm the monthly estimate is acceptable before proceeding

### 2. Create an AWS Budget

Set a hard spending alert before deploying anything:

1. AWS Console → Billing and Cost Management → Budgets → Create Budget
2. Choose **Cost Budget**
3. Budget amount: **$10/month** (or whatever your comfort threshold is)
4. Alert threshold: 80% actual and 100% forecasted
5. Email: your address
6. This alerts you before costs spiral

### 3. Create a Billing Alarm (CloudWatch)

A second layer of protection in addition to the budget:

1. AWS Console → CloudWatch → Alarms → Create Alarm
2. Metric: `Billing > Total Estimated Charge`
3. Threshold: greater than $10
4. Action: notify your email via SNS
5. Note: billing metrics are only available in `us-east-1` regardless of your deployment region

### 4. Confirm Free Tier Status

If your AWS account is less than 12 months old:
- **EC2:** 750 hours/month of `t2.micro` or `t3.micro` (Linux)
- **S3:** 5 GB storage, 20,000 GET, 2,000 PUT requests
- **CloudFront:** 1 TB data transfer out, 10M requests/month
- **Data transfer:** 100 GB out per month free

Free Tier covers a portfolio project's traffic comfortably. Check your account's Free Tier usage in Billing → Free Tier.

### 5. Choose One Region and Stick to It

All resources (EC2, S3, CloudFront origin, ACM certificate) should be in the same region to avoid inter-region data transfer charges. Exception: ACM certificates for CloudFront must be in `us-east-1`.

Recommended for Australian projects: `ap-southeast-2` (Sydney).

### 6. Tag Everything

Before creating any resource, plan to add this tag:

| Key | Value |
|---|---|
| `Project` | `CloudDesk` |

Use the tag consistently so you can filter Cost Explorer by project and see exactly what CloudDesk is costing.

### 7. Keep a Resource Inventory

Maintain a simple list of every AWS resource you create. Delete resources you no longer need. Forgotten running resources are the most common source of unexpected charges.

```
Resource inventory (example):
- EC2: i-0abc123 (t3.micro, ap-southeast-2, running) — clouddesk-api
- S3: clouddesk-client-prod (ap-southeast-2) — React build
- CloudFront: E1ABCD2EFGH3IJ — React SPA distribution
- EBS: vol-0xyz (8GB, attached to i-0abc123)
```

---

## Low-Cost Architecture Choices

### Use One Small EC2 Instance

For a portfolio project, a single `t3.micro` instance is sufficient. Cost: ~$8–10/month on-demand (free if within Free Tier).

Do not use:
- Multiple instances behind a load balancer (adds ~$16/month for the ALB alone)
- `t3.medium` or larger unless there is a demonstrated need

### Avoid NAT Gateway

NAT Gateway costs ~$32/month plus data transfer charges. For this project, the EC2 instance has a public IP directly — no NAT Gateway is needed. Do not add one.

### Avoid Multiple Load Balancers

A Classic or Application Load Balancer costs ~$16–20/month regardless of traffic. Skip it for the initial deployment. Direct EC2 public IP or CloudFront → EC2 is sufficient.

Add an ALB when moving to ECS/auto-scaling in a later stage, not before.

### Use MongoDB Atlas (Not RDS)

The project already uses MongoDB. MongoDB Atlas M0 (free) or M10 (~$57/month) is the correct choice. Do not add an RDS instance — it duplicates cost and complexity with no benefit.

### S3 + CloudFront: Keep It Simple

- Upload only the React build output (`client/dist/`) — no unnecessary files
- Do not enable S3 versioning on the static assets bucket (adds storage cost for every deploy)
- CloudFront caching is aggressive by default — set long cache TTLs for assets (fingerprinted by Vite), short for `index.html`

### Stop EC2 When Not Demoing

If the app is only being used for portfolio demos (not 24/7), consider stopping the EC2 instance between sessions:

```bash
# AWS CLI
aws ec2 stop-instances --instance-ids i-0abc123
aws ec2 start-instances --instance-ids i-0abc123
```

A stopped instance does not incur compute charges (EBS storage still billed at ~$0.80/month for 8GB gp3).

---

## During Deployment

- **Watch the Billing dashboard** — check it the day after deploying and every few days initially
- **Avoid leaving test instances running** — if you launch a second EC2 to test something, terminate it the same session
- **Set a calendar reminder** — check AWS Cost Explorer on the 1st of every month
- **Review log retention if CloudWatch Logs are added** — default retention is "Never expire" which accumulates cost; set a 7 or 30-day retention policy

---

## Teardown Checklist

When the demo period is over, use this checklist to ensure nothing is left running:

| Resource | Action | CLI command |
|---|---|---|
| EC2 instance | Terminate | `aws ec2 terminate-instances --instance-ids <id>` |
| EBS volumes | Delete unattached volumes | EC2 → Volumes → filter "available" → delete |
| EBS snapshots | Delete | EC2 → Snapshots → delete |
| Elastic IP | Release | `aws ec2 release-address --allocation-id <id>` |
| S3 bucket | Empty then delete | `aws s3 rm s3://<bucket> --recursive && aws s3 rb s3://<bucket>` |
| CloudFront | Disable then delete | Console only (disable takes ~15 min before delete is allowed) |
| ACM certificate | Delete | Only if not in use by CloudFront/ALB |
| Route 53 hosted zone | Delete records, then zone | ~$0.50/month per hosted zone |
| MongoDB Atlas | Pause or terminate cluster | Atlas console → Cluster → Pause/Terminate |

After teardown:
1. Check **AWS Cost Explorer** the next day — confirm no unexpected charges
2. Check **EC2 → Volumes** for any orphaned EBS volumes (common miss after termination)
3. Check **EC2 → Elastic IPs** for any unassociated addresses
4. Check **Billing → Free Tier** usage to ensure you haven't exceeded any limits

---

## Cost Risk Notes

These are the most common ways AWS costs escalate unexpectedly on small projects:

| Risk | Why it happens | How to avoid |
|---|---|---|
| NAT Gateway | Added "just in case" for private subnet | Do not add a private subnet for this project |
| Load balancer running idle | Added early, never removed | Skip ALB until ECS/auto-scaling stage |
| EBS volumes after EC2 termination | EC2 termination does not delete EBS by default (depends on "delete on termination" setting) | Check the EBS volumes list after terminating EC2 |
| Elastic IP when unattached | AWS charges for allocated but unattached Elastic IPs | Release immediately if not in use |
| CloudFront invalidations at scale | Automated invalidation scripts run too frequently | First 1000 invalidations/month are free — manual invalidations for this project are fine |
| CloudWatch Logs with no expiry | Default retention is "Never expire" | Set 7-day or 30-day retention if logs are enabled |
| Forgetting a test EC2 | Launched to test something, forgotten | Keep the resource inventory updated; check running instances weekly |
| MongoDB Atlas M10 left running | Higher tier left on after demo | Downgrade to M0 or pause the cluster when not in use |
