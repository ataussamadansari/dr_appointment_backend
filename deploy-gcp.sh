#!/bin/bash
# GCP Cloud Run Deploy Script
# Usage: bash deploy-gcp.sh YOUR_PROJECT_ID

set -e

PROJECT_ID=${1:-"your-gcp-project-id"}
REGION="asia-south1"
SERVICE_NAME="doctor-consulting-backend"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "==> Building Docker image..."
docker build -t "$IMAGE" .

echo "==> Pushing to Google Container Registry..."
docker push "$IMAGE"

echo "==> Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --project="$PROJECT_ID"

echo ""
echo "==> Done! Your backend URL:"
gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(status.url)"
