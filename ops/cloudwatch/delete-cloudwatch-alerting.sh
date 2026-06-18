#!/usr/bin/env bash
# Deletes CloudDesk CloudWatch metric filters and alarms (cost-control cleanup).
# Safe to run if some or all resources have already been deleted.
#
# Does NOT delete:
#   - The /clouddesk/api log group
#   - Log streams or log data
#   - Log retention policy
#   - IAM roles or policies
#
# Custom metric data in CloudDesk/API namespace will expire from CloudWatch
# after approximately 15 months (standard CloudWatch metric retention).
#
# Required IAM permissions:
#   logs:DeleteMetricFilter
#   cloudwatch:DeleteAlarms
#
# Usage:
#   ./delete-cloudwatch-alerting.sh
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
CLOUDWATCH_LOG_GROUP="${CLOUDWATCH_LOG_GROUP:-/clouddesk/api}"

# ── Pre-flight checks ────────────────────────────────────────────────────────

if ! command -v aws &>/dev/null; then
  echo "ERROR: aws CLI is not installed or not in PATH."
  exit 1
fi

echo "Verifying AWS credentials..."
if ! CALLER_ARN=$(aws sts get-caller-identity \
    --query 'Arn' --output text --region "${AWS_REGION}" 2>/dev/null); then
  echo "ERROR: Unable to resolve AWS caller identity."
  exit 1
fi
echo "  Authenticated as: ${CALLER_ARN}"
echo ""

echo "Deleting CloudDesk CloudWatch alerting resources"
echo "  Metric filters : 4 (in ${CLOUDWATCH_LOG_GROUP})"
echo "  Alarms         : 4"
echo "  Region         : ${AWS_REGION}"
echo ""
echo "The log group '${CLOUDWATCH_LOG_GROUP}' and all log data are NOT affected."
echo ""

# ── Helper functions ─────────────────────────────────────────────────────────

# Delete a metric filter, skipping gracefully if it does not exist.
delete_filter() {
  local name="$1"
  if aws logs delete-metric-filter \
      --log-group-name "${CLOUDWATCH_LOG_GROUP}" \
      --filter-name "${name}" \
      --region "${AWS_REGION}" 2>/dev/null; then
    echo "  Deleted metric filter : ${name}"
  else
    echo "  Not found (skipping)  : ${name}"
  fi
}

# Delete a CloudWatch alarm, skipping gracefully if it does not exist.
delete_alarm() {
  local name="$1"
  if aws cloudwatch delete-alarms \
      --alarm-names "${name}" \
      --region "${AWS_REGION}" 2>/dev/null; then
    echo "  Deleted alarm         : ${name}"
  else
    echo "  Not found (skipping)  : ${name}"
  fi
}

# ── Delete metric filters ─────────────────────────────────────────────────────

echo "Metric filters:"
delete_filter "CloudDeskApi5xxCount"
delete_filter "CloudDeskApi4xxCount"
delete_filter "CloudDeskAppErrorLogCount"
delete_filter "CloudDeskApiHighLatencyCount"
echo ""

# ── Delete alarms ─────────────────────────────────────────────────────────────

echo "Alarms:"
delete_alarm "CloudDeskApi5xxAlarm"
delete_alarm "CloudDeskAppErrorLogAlarm"
delete_alarm "CloudDeskHighLatencyAlarm"
delete_alarm "CloudDeskApi4xxSpikeAlarm"
echo ""

echo "Cleanup complete."
echo ""
echo "Not deleted: log group '${CLOUDWATCH_LOG_GROUP}', log streams, and log data."
echo "CloudDesk/API custom metric data expires from CloudWatch after ~15 months."
echo ""
echo "To recreate alerting:"
echo "  ./create-metric-filters.sh"
echo "  ./create-alarms.sh"
