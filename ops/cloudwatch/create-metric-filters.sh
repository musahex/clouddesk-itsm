#!/usr/bin/env bash
# Creates CloudWatch Logs metric filters for CloudDesk API.
#
# Run after CloudWatch Logs is active and the /clouddesk/api log group exists.
# Idempotent: put-metric-filter creates or replaces filters with the same name.
# Metric filters only apply to log events ingested AFTER the filter is created —
# historical data in the log group is not retroactively scanned.
#
# Required IAM permissions (on the calling role/user):
#   logs:PutMetricFilter
#   logs:DescribeMetricFilters
#
# Usage:
#   ./create-metric-filters.sh
#   AWS_REGION=us-east-1 CLOUDWATCH_LOG_GROUP=/clouddesk/api ./create-metric-filters.sh
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
CLOUDWATCH_LOG_GROUP="${CLOUDWATCH_LOG_GROUP:-/clouddesk/api}"
CLOUDWATCH_NAMESPACE="${CLOUDWATCH_NAMESPACE:-CloudDesk/API}"

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

echo "Creating CloudWatch metric filters"
echo "  Log group : ${CLOUDWATCH_LOG_GROUP}"
echo "  Namespace : ${CLOUDWATCH_NAMESPACE}"
echo "  Region    : ${AWS_REGION}"
echo ""

# ── A. 5xx responses ─────────────────────────────────────────────────────────
# Matches any pino request log where the HTTP response status code is >= 500.
# pino log field: $.res.statusCode (set by pino-http on each request)

aws logs put-metric-filter \
  --log-group-name "${CLOUDWATCH_LOG_GROUP}" \
  --filter-name "CloudDeskApi5xxCount" \
  --filter-pattern '{ $.res.statusCode >= 500 }' \
  --metric-transformations \
  "[{\"metricName\":\"Api5xxCount\",\"metricNamespace\":\"${CLOUDWATCH_NAMESPACE}\",\"metricValue\":\"1\",\"defaultValue\":0,\"unit\":\"Count\"}]" \
  --region "${AWS_REGION}"
echo "  Created: CloudDeskApi5xxCount  ->  ${CLOUDWATCH_NAMESPACE}/Api5xxCount"

# ── B. 4xx responses ─────────────────────────────────────────────────────────
# Matches request logs where status code is in the 400–499 range.
# Useful for detecting auth failure spikes, bad requests, or rate limiting.
# Note: 4xx errors are expected user-facing behaviour — they indicate client
# errors, not backend failures. Use a higher alarm threshold for this metric.

aws logs put-metric-filter \
  --log-group-name "${CLOUDWATCH_LOG_GROUP}" \
  --filter-name "CloudDeskApi4xxCount" \
  --filter-pattern '{ $.res.statusCode >= 400 && $.res.statusCode < 500 }' \
  --metric-transformations \
  "[{\"metricName\":\"Api4xxCount\",\"metricNamespace\":\"${CLOUDWATCH_NAMESPACE}\",\"metricValue\":\"1\",\"defaultValue\":0,\"unit\":\"Count\"}]" \
  --region "${AWS_REGION}"
echo "  Created: CloudDeskApi4xxCount  ->  ${CLOUDWATCH_NAMESPACE}/Api4xxCount"

# ── C. pino error-level logs (level >= 50) ───────────────────────────────────
# Matches any pino log event at level 50 (error) or 60 (fatal).
# Captures backend errors beyond HTTP responses — e.g. DB errors, unhandled
# exceptions, startup failures, and middleware errors that are logged but may
# not always result in a 5xx response code.

aws logs put-metric-filter \
  --log-group-name "${CLOUDWATCH_LOG_GROUP}" \
  --filter-name "CloudDeskAppErrorLogCount" \
  --filter-pattern '{ $.level >= 50 }' \
  --metric-transformations \
  "[{\"metricName\":\"AppErrorLogCount\",\"metricNamespace\":\"${CLOUDWATCH_NAMESPACE}\",\"metricValue\":\"1\",\"defaultValue\":0,\"unit\":\"Count\"}]" \
  --region "${AWS_REGION}"
echo "  Created: CloudDeskAppErrorLogCount  ->  ${CLOUDWATCH_NAMESPACE}/AppErrorLogCount"

# ── D. High-latency requests (responseTime >= 1000 ms) ───────────────────────
# Matches request logs where pino-http recorded a responseTime of 1000ms or more.
# This is a count of slow requests, not an average — it is useful for detecting
# sudden latency spikes (e.g. cold DB connections, Atlas reconnect, overload).
# Threshold is tunable: 1000ms is conservative for a demo/portfolio deployment.

aws logs put-metric-filter \
  --log-group-name "${CLOUDWATCH_LOG_GROUP}" \
  --filter-name "CloudDeskApiHighLatencyCount" \
  --filter-pattern '{ $.responseTime >= 1000 }' \
  --metric-transformations \
  "[{\"metricName\":\"ApiHighLatencyCount\",\"metricNamespace\":\"${CLOUDWATCH_NAMESPACE}\",\"metricValue\":\"1\",\"defaultValue\":0,\"unit\":\"Count\"}]" \
  --region "${AWS_REGION}"
echo "  Created: CloudDeskApiHighLatencyCount  ->  ${CLOUDWATCH_NAMESPACE}/ApiHighLatencyCount"

echo ""
echo "All metric filters created."
echo ""
echo "NOTE: Metrics will not appear in CloudWatch until at least one matching log"
echo "event is ingested after this script ran. Send a request to generate data:"
echo "  curl https://d2hz1ibmz7rn7t.cloudfront.net/api/health"
echo ""
echo "Verify with:"
echo "  aws logs describe-metric-filters \\"
echo "    --log-group-name ${CLOUDWATCH_LOG_GROUP} \\"
echo "    --region ${AWS_REGION}"
