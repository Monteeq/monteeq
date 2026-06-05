#!/bin/bash
# Script to build and push backend image to Amazon ECR

# Exit immediately if a command exits with a non-zero status
set -e

# Configuration variables (Modify these to match your AWS environment)
AWS_REGION="${AWS_REGION:-us-west-2}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-037302670720}"
REPO_NAME="${REPO_NAME:-monteeq}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

ECR_URL="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "------------------------------------------------"
echo "🚀 Preparing ECR deployment for ${REPO_NAME}"
echo "📍 Region: ${AWS_REGION}"
echo "📍 ECR URL: ${ECR_URL}"
echo "------------------------------------------------"

# Resolve aws CLI binary path
AWS_CLI="aws"
if ! command -v aws &> /dev/null; then
    if [ -f "$HOME/bin/aws" ]; then
        AWS_CLI="$HOME/bin/aws"
    else
        echo "❌ Error: aws CLI command not found. Please install it or add it to PATH."
        exit 1
    fi
fi

# Step 1: Login to ECR
echo "🔐 Logging into Amazon ECR..."
${AWS_CLI} ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_URL}"

# Step 2: Create ECR repository if it doesn't exist
echo "📦 Checking/creating repository ${REPO_NAME} in ECR..."
${AWS_CLI} ecr describe-repositories --repository-names "${REPO_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1 || \
    ${AWS_CLI} ecr create-repository --repository-name "${REPO_NAME}" --region "${AWS_REGION}"

# Step 3: Build Docker Image
echo "🏗️ Building Docker image..."
# Run build from backend directory
cd "$(dirname "$0")/.."
docker build -t "${REPO_NAME}" .

# Step 4: Tag Image
echo "🏷️ Tagging image..."
docker tag "${REPO_NAME}:latest" "${ECR_URL}/${REPO_NAME}:${IMAGE_TAG}"

# Step 5: Push Image to ECR
echo "🚀 Pushing image to ECR..."
docker push "${ECR_URL}/${REPO_NAME}:${IMAGE_TAG}"

echo "------------------------------------------------"
echo "✅ Deployment image successfully pushed to ECR!"
echo "🐳 Image URI: ${ECR_URL}/${REPO_NAME}:${IMAGE_TAG}"
echo "------------------------------------------------"
