#!/bin/bash
# TinyAct Notification AutoResearch Agent
#
# Run weekly via Cloud Scheduler or cron.
# Schedule: every Monday 02:00 UTC
#
# Prerequisites:
#   - ANTHROPIC_API_KEY environment variable set
#   - Firebase service account credentials (GOOGLE_APPLICATION_CREDENTIALS)
#   - pip install -r requirements.txt
#
# Usage:
#   ./deploy.sh              # Run once manually
#   ./deploy.sh --dry-run    # Show what would happen without making changes

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/agent_logs"

mkdir -p "$LOG_DIR"

LOG_FILE="${LOG_DIR}/$(date +%Y%m%d_%H%M).log"

echo "[$(date)] Starting notification agent..." | tee "$LOG_FILE"

# Check required env vars
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "ERROR: ANTHROPIC_API_KEY not set" | tee -a "$LOG_FILE"
    exit 1
fi

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
    echo "WARNING: GOOGLE_APPLICATION_CREDENTIALS not set, using default credentials" | tee -a "$LOG_FILE"
fi

# Run the agent
cd "$SCRIPT_DIR"
python notification_agent.py 2>&1 | tee -a "$LOG_FILE"

echo "[$(date)] Agent run complete. Log: $LOG_FILE" | tee -a "$LOG_FILE"
