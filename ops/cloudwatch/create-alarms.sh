#!/usr/bin/env bash
# Creates CloudWatch alarms on CloudDesk API custom metrics.
#
# Requires metric filters to be created first: ./create-metric-filters.sh
# Idempotent: put-metric-alarm creates or replaces alarms with the same name.
# Alarms are created with --no-actions-enabled — state changes are visible in
# the CloudWatch console but no SNS notifications are sent.
#
# Required IAM permissions:
#   cloudwatch:PutMetricAlarm
#   cloudwatch:DescribeAlarms
#
# To add SNS notifications later:
#   1. Create an SNS topic and subscribe your email/endpoint
#   2. Note the SNS topic ARN
#   3. Re-run each put-metric-alarm, replacing --no-actions-enabled with:
#        --actions-enabled \
#        --alarm-actions arn:aws:sns:${AWS_REGION}:<account-id>:<topic-name>
#
# Usage:
#   ./create-alarms.sh
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
CLOUDWATCH_NAMESPACE="${CLOUDWATCH_NAMESPACE:-CloudDesk/API}"

# Thresholds — tuned conservatively for a portfolio/demo deployment with low traffic.
# Tune upward for higher-traffic environments once production baselines are known.
THRESHOLD_5XX=1      # alert on the first 5xx response in any 5-minute window
THRESHOLD_ERROR=1    # alert on the first error-level log in any 5-minute window
THRESHOLD_LATENCY=5  # alert when 5+ requests exceed 1000ms in a 5-minute window
THRESHOLD_4XX=20     # alert on a spike of 20+ 4xx responses in a 5-minute window

PERIOD=300           # 5-minute evaluation period (seconds)

# ── Pre-flight checks ────────────────────────────────────────────────────────

if ! command -v aws &>/dev/null; then
  echo "ERROR: aws CLI is not installed or not in PATH."
  echo "Install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  exit 1
fi

echo "Verifying AWS credentials..."
if ! CALLER_ARN=$(aws sts get-caller-identity \
    --query 'Arn' --output text --region "${AWS_REGION}" 2>/dev/null); then
  echo "ERROR: Unable to resolve AWS caller identity."
  echo "Ensure credentials are configured (EC2 instance profile, env vars, or ~/.aws/credentials)."
  exit 1
fi
echo "  Authenticated as: ${CALLER_ARN}"
echo ""

echo "Creating CloudWatch alarms"
echo "  Namespace : ${CLOUDWATCH_NAMESPACE}"
echo "  Region    : ${AWS_REGION}"
echo "  Period    : ${PERIOD}s ($(( PERIOD / 60 )) minutes)"
echo "  Actions   : DISABLED (console-visible only — no SNS notifications)"
echo ""

# ── A. 5xx alarm ─────────────────────────────────────────────────────────────
# Triggers when 1+ HTTP 5xx responses occur within a 5-minute window.
# TreatMissingData=notBreaching: periods with no traffic do not trigger the alarm.
#
# To add SNS notification later, remove --no-actions-enabled and add:
#   --actions-enabled \
#   --alarm-actions arn:aws:sns:${AWS_REGION}:<account-id>:<topic>

aws cloudwatch put-metric-alarm \
  --alarm-name "CloudDeskApi5xxAlarm" \
  --alarm-description "CloudDesk API: one or more 5xx responses in a 5-minute window" \
  --namespace "${CLOUDWATCH_NAMESPACE}" \
  --metric-name "Api5xxCount" \
  --statistic "Sum" \
  --period "${PERIOD}" \
  --evaluation-periods 1 \
  --datapoints-to-alarm 1 \
  --threshold "${THRESHOLD_5XX}" \
  --comparison-operator "GreaterThanOrEqualToThreshold" \
  --treat-missing-data "notBreaching" \
  --unit "Count" \
  --no-actions-enabled \
  --region "${AWS_REGION}"
echo "  Created: CloudDeskApi5xxAlarm  (threshold: Sum >= ${THRESHOLD_5XX} per ${PERIOD}s)"

# ── B. Application error log alarm ───────────────────────────────────────────
# Triggers when pino emits 1+ error-level log lines (level >= 50) in 5 minutes.
# Catches backend errors that may not always produce an HTTP 5xx response —
# e.g. DB errors logged before a response is sent, or middleware exceptions.
#
# To add SNS notification later, see comment in section A.

aws cloudwatch put-metric-alarm \
  --alarm-name "CloudDeskAppErrorLogAlarm" \
  --alarm-description "CloudDesk API: one or more error-level log events in a 5-minute window" \
  --namespace "${CLOUDWATCH_NAMESPACE}" \
  --metric-name "AppErrorLogCount" \
  --statistic "Sum" \
  --period "${PERIOD}" \
  --evaluation-periods 1 \
  --datapoints-to-alarm 1 \
  --threshold "${THRESHOLD_ERROR}" \
  --comparison-operator "GreaterThanOrEqualToThreshold" \
  --treat-missing-data "notBreaching" \
  --unit "Count" \
  --no-actions-enabled \
  --region "${AWS_REGION}"
echo "  Created: CloudDeskAppErrorLogAlarm  (threshold: Sum >= ${THRESHOLD_ERROR} per ${PERIOD}s)"

# ── C. High latency alarm ─────────────────────────────────────────────────────
# Triggers when 5+ requests take >= 1000ms within a 5-minute window.
# A threshold > 1 avoids false positives from occasional Atlas reconnect latency
# or container cold starts. Tune down if faster alerting is needed.
#
# To add SNS notification later, see comment in section A.

aws cloudwatch put-metric-alarm \
  --alarm-name "CloudDeskHighLatencyAlarm" \
  --alarm-description "CloudDesk API: five or more requests over 1000ms in a 5-minute window" \
  --namespace "${CLOUDWATCH_NAMESPACE}" \
  --metric-name "ApiHighLatencyCount" \
  --statistic "Sum" \
  --period "${PERIOD}" \
  --evaluation-periods 1 \
  --datapoints-to-alarm 1 \
  --threshold "${THRESHOLD_LATENCY}" \
  --comparison-operator "GreaterThanOrEqualToThreshold" \
  --treat-missing-data "notBreaching" \
  --unit "Count" \
  --no-actions-enabled \
  --region "${AWS_REGION}"
echo "  Created: CloudDeskHighLatencyAlarm  (threshold: Sum >= ${THRESHOLD_LATENCY} per ${PERIOD}s)"

# ── D. 4xx spike alarm ───────────────────────────────────────────────────────
# Triggers on a 4xx spike — typically indicates auth failure bursts, scraping,
# or a client misconfiguration. Not a backend failure indicator on its own.
# Higher threshold (20) because 4xx responses are expected normal behaviour.
#
# To add SNS notification later, see comment in section A.

aws cloudwatch put-metric-alarm \
  --alarm-name "CloudDeskApi4xxSpikeAlarm" \
  --alarm-description "CloudDesk API: 4xx spike — 20 or more 4xx responses in a 5-minute window" \
  --namespace "${CLOUDWATCH_NAMESPACE}" \
  --metric-name "Api4xxCount" \
  --statistic "Sum" \
  --period "${PERIOD}" \
  --evaluation-periods 1 \
  --datapoints-to-alarm 1 \
  --threshold "${THRESHOLD_4XX}" \
  --comparison-operator "GreaterThanOrEqualToThreshold" \
  --treat-missing-data "notBreaching" \
  --unit "Count" \
  --no-actions-enabled \
  --region "${AWS_REGION}"
echo "  Created: CloudDeskApi4xxSpikeAlarm  (threshold: Sum >= ${THRESHOLD_4XX} per ${PERIOD}s)"

echo ""
echo "All alarms created with actions DISABLED."
echo "State changes (OK → ALARM → OK) are visible in CloudWatch → Alarms."
echo "No notifications will be sent until actions are enabled with an SNS topic."
echo ""
echo "Verify:"
echo "  aws cloudwatch describe-alarms \\"
echo "    --alarm-name-prefix CloudDesk \\"
echo "    --region ${AWS_REGION} \\"
echo "    --query 'MetricAlarms[*].[AlarmName,StateValue,ActionsEnabled]' \\"
echo "    --output table"
