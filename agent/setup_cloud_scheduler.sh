#!/bin/bash
# Deploy the TinyAct notification agent to Cloud Run and wire up Cloud Scheduler.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Enabled APIs: Cloud Run, Cloud Build, Cloud Scheduler, Pub/Sub, Artifact Registry
#   - ANTHROPIC_API_KEY set in environment (will be stored in Secret Manager)
#
# This script:
#   1. Stores ANTHROPIC_API_KEY in Secret Manager
#   2. Builds + deploys the agent to Cloud Run
#   3. Creates Pub/Sub topic + push subscription to the Cloud Run service
#   4. Creates Cloud Scheduler job (weekly Monday 02:00 UTC)
#   5. Triggers an immediate first run

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-microcommit-973c7}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="notification-agent"
TOPIC_NAME="notification-agent-trigger"
SUBSCRIPTION_NAME="notification-agent-push"
JOB_NAME="weekly-notification-agent"
SECRET_NAME="anthropic-api-key"
AGENT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "TinyAct Notification Agent — Cloud Deploy"
echo "========================================="
echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo ""

# Check ANTHROPIC_API_KEY
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "ERROR: ANTHROPIC_API_KEY environment variable is required."
    echo "  export ANTHROPIC_API_KEY=sk-ant-..."
    exit 1
fi

# 1. Enable required APIs
echo "[1/6] Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    cloudscheduler.googleapis.com \
    pubsub.googleapis.com \
    secretmanager.googleapis.com \
    artifactregistry.googleapis.com \
    --project="$PROJECT_ID" --quiet

# 2. Store ANTHROPIC_API_KEY in Secret Manager
echo "[2/6] Storing ANTHROPIC_API_KEY in Secret Manager..."
if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
    echo "  Secret exists, adding new version..."
    echo -n "$ANTHROPIC_API_KEY" | gcloud secrets versions add "$SECRET_NAME" \
        --project="$PROJECT_ID" --data-file=-
else
    echo -n "$ANTHROPIC_API_KEY" | gcloud secrets create "$SECRET_NAME" \
        --project="$PROJECT_ID" --data-file=- --replication-policy="automatic"
fi

# 3. Build and deploy to Cloud Run
echo "[3/6] Building and deploying Cloud Run service..."
cd "$AGENT_DIR"

gcloud run deploy "$SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --source="." \
    --set-secrets="ANTHROPIC_API_KEY=${SECRET_NAME}:latest" \
    --memory="512Mi" \
    --timeout="300" \
    --min-instances=0 \
    --max-instances=1 \
    --no-allow-unauthenticated \
    --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format="value(status.url)")
echo "  Service URL: $SERVICE_URL"

# 4. Create Pub/Sub topic and push subscription
echo "[4/6] Setting up Pub/Sub topic and push subscription..."

gcloud pubsub topics create "$TOPIC_NAME" \
    --project="$PROJECT_ID" 2>/dev/null || echo "  Topic already exists"

# Grant Cloud Run invoker role to Pub/Sub service account
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
PUBSUB_SA="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"

gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --member="serviceAccount:${PUBSUB_SA}" \
    --role="roles/run.invoker" \
    --quiet

# Create push subscription (or update if exists)
if gcloud pubsub subscriptions describe "$SUBSCRIPTION_NAME" --project="$PROJECT_ID" &>/dev/null; then
    echo "  Subscription exists, updating..."
    gcloud pubsub subscriptions update "$SUBSCRIPTION_NAME" \
        --project="$PROJECT_ID" \
        --push-endpoint="$SERVICE_URL"
else
    gcloud pubsub subscriptions create "$SUBSCRIPTION_NAME" \
        --project="$PROJECT_ID" \
        --topic="$TOPIC_NAME" \
        --push-endpoint="$SERVICE_URL" \
        --ack-deadline=300 \
        --push-auth-service-account="${PUBSUB_SA}"
fi

# 5. Create Cloud Scheduler job
echo "[5/6] Creating Cloud Scheduler job..."
gcloud scheduler jobs create pubsub "$JOB_NAME" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --schedule="0 2 * * 1" \
    --topic="$TOPIC_NAME" \
    --message-body='{"action": "run_agent"}' \
    --description="Weekly TinyAct notification AutoResearch agent" \
    --time-zone="UTC" \
    2>/dev/null || {
        echo "  Job already exists, updating..."
        gcloud scheduler jobs update pubsub "$JOB_NAME" \
            --project="$PROJECT_ID" \
            --location="$REGION" \
            --schedule="0 2 * * 1" \
            --topic="$TOPIC_NAME" \
            --message-body='{"action": "run_agent"}' \
            --description="Weekly TinyAct notification AutoResearch agent" \
            --time-zone="UTC"
    }

# 6. Trigger immediate first run
echo "[6/6] Triggering immediate first run..."
gcloud scheduler jobs run "$JOB_NAME" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    && echo "  First run triggered successfully." \
    || echo "  Warning: Could not trigger first run."

echo ""
echo "========================================="
echo "Deployment complete!"
echo "========================================="
echo "  Cloud Run:  $SERVICE_URL"
echo "  Scheduler:  Every Monday at 02:00 UTC"
echo "  Secret:     $SECRET_NAME (Secret Manager)"
echo ""
echo "Useful commands:"
echo "  View logs:    gcloud run logs read --service=$SERVICE_NAME --project=$PROJECT_ID --region=$REGION"
echo "  Manual run:   gcloud scheduler jobs run $JOB_NAME --project=$PROJECT_ID --location=$REGION"
echo "  Update key:   echo -n 'new-key' | gcloud secrets versions add $SECRET_NAME --project=$PROJECT_ID --data-file=-"
