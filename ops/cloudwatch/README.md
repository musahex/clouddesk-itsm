# CloudDesk CloudWatch Alerting

Operational scripts for adding CloudWatch metric filters and alarms on top of the CloudWatch Logs integration already active in production.

---

## Purpose

CloudDesk API logs are shipped to CloudWatch Logs (`/clouddesk/api`, `us-east-1`) on every production deployment. This directory adds the next observability layer: **metric filters** extract signal from structured JSON log lines, and **CloudWatch alarms** alert when that signal crosses a threshold.

The scripts in this directory are run manually — they are not called from CI/CD. They create permanent AWS resources that persist until explicitly deleted.

---

## What Gets Created

| Script | Creates |
|---|---|
| `create-metric-filters.sh` | 4 CloudWatch Logs metric filters |
| `create-alarms.sh` | 4 CloudWatch alarms |

### Metric filters (namespace: `CloudDesk/API`)

| Filter name | Metric name | Log field matched | Meaning |
|---|---|---|---|
| `CloudDeskApi5xxCount` | `Api5xxCount` | `$.res.statusCode >= 500` | HTTP 5xx responses |
| `CloudDeskApi4xxCount` | `Api4xxCount` | `$.res.statusCode >= 400 && < 500` | HTTP 4xx responses |
| `CloudDeskAppErrorLogCount` | `AppErrorLogCount` | `$.level >= 50` | pino error/fatal log events |
| `CloudDeskApiHighLatencyCount` | `ApiHighLatencyCount` | `$.responseTime >= 1000` | Requests over 1000ms |

### Alarms

| Alarm name | Metric | Threshold | Meaning |
|---|---|---|---|
| `CloudDeskApi5xxAlarm` | `Api5xxCount` | Sum ≥ 1 per 5 min | Any backend error response |
| `CloudDeskAppErrorLogAlarm` | `AppErrorLogCount` | Sum ≥ 1 per 5 min | Any pino error-level log |
| `CloudDeskHighLatencyAlarm` | `ApiHighLatencyCount` | Sum ≥ 5 per 5 min | Latency spike (5+ slow requests) |
| `CloudDeskApi4xxSpikeAlarm` | `Api4xxCount` | Sum ≥ 20 per 5 min | Client error spike |

All alarms are created with **actions disabled** — state changes are visible in the CloudWatch console but no notifications are sent. See [Adding SNS notifications](#adding-sns-notifications-later) to enable alerts.

---

## Why No High-Cardinality Dimensions

None of the metric filters include dimensions for path, user, IP address, or request ID. High-cardinality dimensions create a separate metric time series for each unique value, which rapidly multiplies custom metric costs.

**Not used as dimensions:**
- Request path (`/api/tickets/:id`) — O(N) unique paths per route
- User ID or email — every user gets a separate metric stream
- IP address — unbounded
- Request ID — unique per request, creates a metric per request

**What this means in practice:**
Each metric is a single aggregate count across all requests. To drill into which path or user caused a spike, query CloudWatch Logs directly with `aws logs filter-log-events` or CloudWatch Logs Insights.

---

## Required IAM Permissions

To run these scripts, the calling IAM identity needs:

| Permission | Used by |
|---|---|
| `logs:PutMetricFilter` | `create-metric-filters.sh` |
| `logs:DescribeMetricFilters` | `create-metric-filters.sh`, `verify-cloudwatch-alerting.sh` |
| `logs:DeleteMetricFilter` | `delete-cloudwatch-alerting.sh` |
| `cloudwatch:PutMetricAlarm` | `create-alarms.sh` |
| `cloudwatch:DescribeAlarms` | `create-alarms.sh`, `verify-cloudwatch-alerting.sh` |
| `cloudwatch:DeleteAlarms` | `delete-cloudwatch-alerting.sh` |
| `cloudwatch:ListMetrics` | `verify-cloudwatch-alerting.sh` |

The EC2 instance profile (used for log shipping) does not include these permissions by default — run the scripts from a local terminal with appropriate AWS credentials or a separate IAM user/role.

---

## Setup

```bash
cd ops/cloudwatch
chmod +x *.sh

# 1. Create the metric filters (one-time setup)
./create-metric-filters.sh

# 2. Create the alarms (one-time setup)
./create-alarms.sh

# 3. Verify everything is in place
./verify-cloudwatch-alerting.sh
```

Environment variables (all have sensible defaults):

| Variable | Default | Description |
|---|---|---|
| `AWS_REGION` | `us-east-1` | AWS region |
| `CLOUDWATCH_LOG_GROUP` | `/clouddesk/api` | CloudWatch log group name |
| `CLOUDWATCH_NAMESPACE` | `CloudDesk/API` | Custom metric namespace |

Override example:
```bash
AWS_REGION=us-west-2 CLOUDWATCH_LOG_GROUP=/clouddesk/api-staging ./create-metric-filters.sh
```

---

## Generate Test Events

Send safe requests to confirm logs flow through to CloudWatch and metrics are published:

```bash
# Health check — generates an info-level log event
curl https://d2hz1ibmz7rn7t.cloudfront.net/api/health

# Readiness check
curl https://d2hz1ibmz7rn7t.cloudfront.net/api/health/ready

# Non-existent route — generates a 404 (4xx metric)
curl https://d2hz1ibmz7rn7t.cloudfront.net/api/does-not-exist
```

The 404 request will increment `Api4xxCount` but will not trigger `CloudDeskApi5xxAlarm` or `CloudDeskAppErrorLogAlarm`. Check the CloudWatch console after 1–2 minutes to see the data point.

**For 5xx testing:** Do not intentionally break production. 5xx alarms should be validated during a controlled test or a future staging environment. If Sentry is active, it will also capture any 5xx errors independently.

---

## Verify

```bash
./verify-cloudwatch-alerting.sh
```

Or directly with AWS CLI:

```bash
# List metric filters on the log group
aws logs describe-metric-filters \
  --log-group-name /clouddesk/api \
  --region us-east-1

# List published metrics in the custom namespace
aws cloudwatch list-metrics \
  --namespace CloudDesk/API \
  --region us-east-1

# Show alarm names and current states
aws cloudwatch describe-alarms \
  --alarm-name-prefix CloudDesk \
  --region us-east-1 \
  --query 'MetricAlarms[*].[AlarmName,StateValue,ActionsEnabled]' \
  --output table
```

---

## Adding SNS Notifications Later

To receive email or webhook alerts when an alarm fires:

1. Create an SNS topic in the AWS console or CLI
2. Subscribe your email address to the topic and confirm the subscription
3. Re-run the alarm creation with `--actions-enabled` and `--alarm-actions`:

```bash
# Example: update the 5xx alarm to send to an SNS topic
aws cloudwatch put-metric-alarm \
  --alarm-name "CloudDeskApi5xxAlarm" \
  --alarm-description "CloudDesk API: one or more 5xx responses in a 5-minute window" \
  --namespace "CloudDesk/API" \
  --metric-name "Api5xxCount" \
  --statistic "Sum" \
  --period 300 \
  --evaluation-periods 1 \
  --datapoints-to-alarm 1 \
  --threshold 1 \
  --comparison-operator "GreaterThanOrEqualToThreshold" \
  --treat-missing-data "notBreaching" \
  --unit "Count" \
  --actions-enabled \
  --alarm-actions "arn:aws:sns:us-east-1:<account-id>:<topic-name>" \
  --region us-east-1
```

Repeat for each alarm that should send notifications.

---

## Cleanup

```bash
./delete-cloudwatch-alerting.sh
```

This deletes the 4 metric filters and 4 alarms. It does **not** delete:
- The `/clouddesk/api` log group
- Log streams or log data
- Log retention policy
- IAM roles

Custom metric data in the `CloudDesk/API` namespace expires from CloudWatch after approximately 15 months.

---

## Cost Control

- **Custom metrics**: approximately $0.30/metric/month for the first 10,000 metrics. With 4 metrics this is a negligible cost.
- **Avoid high-cardinality dimensions**: adding path or user dimensions could create hundreds of metric streams. The current setup uses aggregate-only metrics with no dimensions.
- **Delete when not needed**: run `./delete-cloudwatch-alerting.sh` to stop metric publication if the project is paused. Log data is unaffected.
- **Log retention**: the `/clouddesk/api` log group has a 7-day retention policy, controlling log storage cost (~$0.03/GB/month).
- **Alarm evaluations**: CloudWatch alarm evaluation is free for standard-resolution alarms.

---

## Future Improvements

- **SNS email notifications** — subscribe an email address to an SNS topic and wire it to the alarms (see [Adding SNS Notifications](#adding-sns-notifications-later))
- **Slack or PagerDuty integration** — forward SNS to a Lambda that calls a webhook
- **CloudWatch dashboard** — visualise `Api5xxCount`, `AppErrorLogCount`, and `ApiHighLatencyCount` alongside EC2 CPU and memory metrics on a single operations board
- **Staging environment** — a separate log group and alarm set for validating 5xx behaviour without touching production
- **Alarm tuning** — after real production traffic baselines are known, adjust thresholds and evaluation periods to reduce noise
- **CloudFormation or CDK** — manage log group, metric filters, alarms, and IAM policy as infrastructure-as-code for repeatable, auditable setup
