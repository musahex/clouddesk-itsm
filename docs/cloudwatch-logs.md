# CloudDesk CloudWatch Logs Integration

## Purpose

CloudDesk already produces structured JSON logs through `pino` and `pino-http`. Every inbound request, startup event, and error is logged as a newline-delimited JSON object to Docker stdout.

Currently, those logs live only on the EC2 instance. They are visible via `docker compose logs` while the container is running, but they are ephemeral — if the container is replaced or the instance is terminated, the log history is gone.

AWS CloudWatch Logs provides centralised, persistent, searchable log storage. Shipping Docker logs to CloudWatch allows:
- Durable storage beyond the lifetime of an EC2 instance
- Log search and filtering via CloudWatch Logs Insights
- Foundation for CloudWatch metric filters and alarms (e.g. 5xx error rate)
- Incident investigation without SSH access to EC2

CloudWatch logging is now **active in production**. The deploy workflow (`deploy.yml`) uses `docker-compose.cloudwatch.yml` by default on every push to `main`. `docker-compose.prod.yml` is unchanged — CloudWatch shipping is applied via the Compose override file.

---

## Current Logging

Docker stdout logs are available on EC2 via:

```bash
docker compose -f docker-compose.prod.yml logs api --tail=80
docker compose -f docker-compose.prod.yml logs -f api
```

**Limitations of the current setup:**
- Logs are local to the EC2 instance only
- Logs are lost if the container is stopped, replaced, or the instance is terminated
- No central retention policy — disk space grows until Docker prunes old containers
- No cross-session search — `docker logs` only covers the current container lifetime
- No alerting based on log content

---

## Target Logging Flow

```
Express API
  ↓
pino JSON logs (structured, redacted)
  ↓
Docker stdout
  ↓
Docker awslogs logging driver
  ↓
CloudWatch Log Group: /clouddesk/api
  ↓
CloudWatch Log Streams (one per container/task restart)
```

Log content is unchanged — pino still emits the same JSON format, with Authorization headers and passwords redacted. The only change is the destination: Docker captures stdout and forwards it to CloudWatch instead of keeping it locally.

---

## Files Added

### `docker-compose.cloudwatch.yml`

An optional Compose override file that adds the `awslogs` logging driver to the `api` service.

```yaml
services:
  api:
    logging:
      driver: awslogs
      options:
        awslogs-region: ${AWS_REGION:-us-east-1}
        awslogs-group: ${CLOUDWATCH_LOG_GROUP:-/clouddesk/api}
        tag: "api-{{.ID}}"
        awslogs-create-group: "false"
```

**Key design decisions:**

- `awslogs-create-group: "false"` — the log group must be created manually with a retention policy before this file is used. Allowing Docker to auto-create log groups produces groups with no retention, which accumulates cost indefinitely.
- `tag: "api-{{.ID}}"` — log stream name includes the short container ID, which is compatible with the Docker `awslogs` driver. `awslogs-stream-prefix` is not used as it is not a valid Docker Compose `awslogs` option.
- No AWS credentials in the file — authentication uses the EC2 instance IAM role (instance profile). No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` should ever appear in this file.
- Region defaults to `us-east-1` (where the EC2 instance is deployed — `us-east-1c`) but is overridable via `AWS_REGION`.
- The override applies only to the `api` service. `mongo` and `redis` keep their default logging behaviour (Docker stdout, used only in the local `docker-compose.yml` stack).

**This file is used by `deploy.yml` on every push to `main`.** CI/CD backend deployments include the CloudWatch override by default. `docker-compose.prod.yml` is unchanged — the override is applied on top via `-f docker-compose.cloudwatch.yml`.

---

## Required AWS Setup

These steps must be completed manually before using the CloudWatch override. Do not run the override until all steps are verified.

### 1. Create the CloudWatch Log Group

```bash
aws logs create-log-group \
  --log-group-name /clouddesk/api \
  --region us-east-1
```

### 2. Set retention policy

Recommended for a portfolio/demo deployment: 7 or 14 days. This controls log storage cost.

```bash
aws logs put-retention-policy \
  --log-group-name /clouddesk/api \
  --retention-in-days 14 \
  --region us-east-1
```

Do not leave retention as "Never expire" — CloudWatch log storage is billed per GB stored.

### 3. Attach IAM permissions to the EC2 instance role

The EC2 instance must have an IAM instance profile attached with the following permissions on the log group:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams",
        "logs:DescribeLogGroups"
      ],
      "Resource": [
        "arn:aws:logs:us-east-1:*:log-group:/clouddesk/api:*"
      ]
    }
  ]
}
```

Note: `logs:CreateLogGroup` is intentionally **not included** because `awslogs-create-group: "false"` prevents Docker from attempting to create the group. The group is created manually in step 1.

### 4. Confirm EC2 instance profile

The EC2 instance must have an instance profile (IAM role) attached. Verify in the EC2 console:

- EC2 → Instances → your instance → IAM role (should be non-empty)

If no role is attached, create one in IAM → Roles → Create role → EC2 use case, attach the policy above, then attach it to the instance.

### 5. Confirm region

The `aws-deployment-runbook.md` documents `us-east-1` (Sydney). Set `AWS_REGION=us-east-1` when running the override command.

---

## EC2 Commands

### Check current logs (before CloudWatch)

```bash
docker compose -f docker-compose.prod.yml logs api --tail=80
```

### Enable CloudWatch logging (after AWS setup)

```bash
AWS_REGION=us-east-1 \
CLOUDWATCH_LOG_GROUP=/clouddesk/api \
docker compose -f docker-compose.prod.yml -f docker-compose.cloudwatch.yml up -d --build
```

### Check container and health after restart

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.cloudwatch.yml ps

curl http://localhost:5001/api/health
curl http://localhost:5001/api/health/ready
```

**Important:** When using the `awslogs` driver, `docker compose logs api` will no longer show log output in the terminal — Docker has handed log delivery to CloudWatch. Use CloudWatch Logs console or AWS CLI (see below) to inspect logs.

---

## AWS CLI Verification

After enabling CloudWatch logging and restarting the container, verify logs are arriving:

```bash
# Confirm log group exists
aws logs describe-log-groups \
  --log-group-name-prefix /clouddesk/api \
  --region us-east-1

# List recent log streams (one per container restart)
aws logs describe-log-streams \
  --log-group-name /clouddesk/api \
  --region us-east-1 \
  --order-by LastEventTime \
  --descending \
  --max-items 5

# View the most recent log events
aws logs filter-log-events \
  --log-group-name /clouddesk/api \
  --region us-east-1 \
  --limit 20
```

A successful deployment will show JSON log lines from pino within 1–2 minutes of the container starting.

---

## Rollback

To disable CloudWatch logging temporarily (manual rollback on EC2):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This starts the stack without the CloudWatch override. The `api` container uses the default Docker `json-file` logging driver and logs are available again via `docker compose logs api`. No application code change is required.

**Important:** The next GitHub Actions deployment to `main` will re-enable CloudWatch logging automatically, because `deploy.yml` includes the `-f docker-compose.cloudwatch.yml` override by default. To permanently disable CloudWatch logging through CI/CD, remove the `-f docker-compose.cloudwatch.yml` flag from the deploy command in `.github/workflows/deploy.yml`.

Log data already in CloudWatch is not deleted by the rollback — it remains in the log group until the retention period expires or it is explicitly deleted.

---

## What Is Not Logged

pino's log redaction, configured in `server/src/index.ts`, ensures the following are never included in any log line:

- `Authorization` headers — contain JWT bearer tokens
- `req.body.password` — user password field
- `req.body.token` — any token field in the request body

Additionally, the following are never written to logs anywhere in the application:

- MongoDB URI (`MONGO_URI`)
- JWT secret (`JWT_SECRET`)
- Sentry DSN (`SENTRY_DSN`)
- Redis URL (`REDIS_URL`)
- Request bodies (beyond the redacted fields above)
- Individual user emails or IDs in request-level logs
- Stack traces in production API responses

These guarantees hold regardless of whether logs go to Docker stdout or CloudWatch.

---

## Cost Control

- **Set a retention policy before enabling.** Log group retention defaults to "Never expire" if not set. Always set 7–14 days for a portfolio/demo deployment.
- **Avoid load testing against production with CloudWatch enabled.** High request rates generate high log ingestion volume. CloudWatch pricing is approximately $0.50/GB ingested and $0.03/GB stored per month. A high-volume load test session could generate unexpected charges.
- **Use structured but concise logs.** pino's `info` level is appropriate for production. Do not set `LOG_LEVEL=debug` in production — debug logging is far more verbose and increases ingestion cost.
- **Review the AWS Cost Control guide** at `docs/aws-cost-control.md` before enabling CloudWatch billing.

---

## CloudWatch Metric Filters and Alarms

CloudWatch Logs is the foundation for metric-based alerting. The `ops/cloudwatch/` directory contains scripts to create CloudWatch metric filters and alarms on top of the log data already being shipped.

**Metric filters extract counts from structured log fields:**

| Filter | Metric | Log field | Description |
|---|---|---|---|
| `CloudDeskApi5xxCount` | `Api5xxCount` | `$.res.statusCode >= 500` | HTTP 5xx responses |
| `CloudDeskApi4xxCount` | `Api4xxCount` | `$.res.statusCode >= 400 && < 500` | HTTP 4xx responses |
| `CloudDeskAppErrorLogCount` | `AppErrorLogCount` | `$.level >= 50` | pino error/fatal log events |
| `CloudDeskApiHighLatencyCount` | `ApiHighLatencyCount` | `$.responseTime >= 1000` | Requests over 1000ms |

All metrics are published to the `CloudDesk/API` custom namespace with no high-cardinality dimensions.

**Quick setup:**

```bash
cd ops/cloudwatch
chmod +x *.sh
./create-metric-filters.sh
./create-alarms.sh
./verify-cloudwatch-alerting.sh
```

**Important:** Metric filters only apply to log events ingested after the filter is created — historical data is not retroactively scanned. Metrics will not appear in CloudWatch until a matching log event occurs.

See `ops/cloudwatch/README.md` for the full guide including IAM permissions, alarm configuration, and cleanup.

---

## Future Improvements

Once CloudWatch Logs is active, these additional steps become possible:

**CloudWatch metric filters** — Extract numeric metrics from JSON log fields. For example, filter for `"statusCode":5` to count 5xx errors per minute and publish a custom metric.

**CloudWatch alarms** — Alert via SNS when the 5xx error rate metric exceeds a threshold (e.g. >1% over a 5-minute window).

**CloudWatch Logs Insights** — Query log data with structured queries, for example: find all requests with `responseTime > 500`, or group errors by path.

**CloudWatch dashboard widgets** — Visualise API request rate, p99 latency (if published as a metric), and error rate alongside EC2 CPU/memory metrics on a single operations dashboard.

**ECS/Fargate log configuration** — When migrating to ECS (Phase 7.5), the `awslogs` driver is configured in the ECS task definition, not in a Compose override. The log group and IAM permissions created in this phase are reused without modification.

**Infrastructure as Code** — Log group creation, retention policy, and IAM permissions can later be managed in CloudFormation or Terraform to ensure consistent, auditable setup across environments.
