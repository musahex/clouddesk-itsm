#!/usr/bin/env bash
# Verifies CloudDesk CloudWatch metric filters and alarms are present.
# Read-only — does not create or modify any resources.
#
# Required IAM permissions:
#   logs:DescribeMetricFilters
#   cloudwatch:DescribeAlarms
#   cloudwatch:ListMetrics
#
# Usage:
#   ./verify-cloudwatch-alerting.sh
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
CLOUDWATCH_LOG_GROUP="${CLOUDWATCH_LOG_GROUP:-/clouddesk/api}"
CLOUDWATCH_NAMESPACE="${CLOUDWATCH_NAMESPACE:-CloudDesk/API}"

# ── Pre-flight checks ────────────────────────────────────────────────────────

if ! command -v aws &>/dev/null; then
  echo "ERROR: aws CLI is not installed or not in PATH."
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

echo "=== CloudDesk CloudWatch Alerting Verification ==="
echo "  Log group : ${CLOUDWATCH_LOG_GROUP}"
echo "  Namespace : ${CLOUDWATCH_NAMESPACE}"
echo "  Region    : ${AWS_REGION}"
echo ""

# ── Metric filters ────────────────────────────────────────────────────────────

echo "── Metric filters on ${CLOUDWATCH_LOG_GROUP} ──────────────────────────────────"
aws logs describe-metric-filters \
  --log-group-name "${CLOUDWATCH_LOG_GROUP}" \
  --region "${AWS_REGION}" \
  --query 'metricFilters[*].[filterName,filterPattern]' \
  --output table 2>/dev/null \
  || { echo "  None found.  Run: ./create-metric-filters.sh"; }
echo ""

# ── Custom metrics ────────────────────────────────────────────────────────────

echo "── Custom metrics in namespace ${CLOUDWATCH_NAMESPACE} ─────────────────────────"
echo "  NOTE: Metrics only appear after at least one matching log event is ingested"
echo "  after the filter was created. If empty, send an API request to generate data:"
echo "    curl https://d2hz1ibmz7rn7t.cloudfront.net/api/health"
echo ""
aws cloudwatch list-metrics \
  --namespace "${CLOUDWATCH_NAMESPACE}" \
  --region "${AWS_REGION}" \
  --query 'Metrics[*].[MetricName]' \
  --output table 2>/dev/null \
  || { echo "  None found yet."; }
echo ""

# ── Alarms ────────────────────────────────────────────────────────────────────

echo "── Alarms with prefix 'CloudDesk' ──────────────────────────────────────────"
aws cloudwatch describe-alarms \
  --alarm-name-prefix "CloudDesk" \
  --region "${AWS_REGION}" \
  --query 'MetricAlarms[*].[AlarmName,StateValue,ActionsEnabled]' \
  --output table 2>/dev/null \
  || { echo "  None found.  Run: ./create-alarms.sh"; }
echo ""

echo "── Alarm state reference ────────────────────────────────────────────────────"
echo "  OK                 metric is within threshold (expected when idle or healthy)"
echo "  ALARM              metric has breached the threshold"
echo "  INSUFFICIENT_DATA  alarm has not yet received any data points"
echo ""
echo "All alarms use ActionsEnabled=False — state changes are visible in the"
echo "CloudWatch console but no notifications are sent."
echo ""
echo "Metric filters only publish data for matching log events ingested AFTER"
echo "the filter was created. Historical log data is not retroactively scanned."
