---
title: Monteeq Video Service
emoji: 🎥
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Monteeq Video Service

High-performance, asynchronous Rust service for processing and transcoding video to HLS.

## Configuration

This service requires connection to a Redis server and an AWS S3 bucket (or compatible storage). In your Hugging Face Space settings, add the following **Variables and Secrets**:

| Secret Name | Description |
|---|---|
| `REDIS_URL` | Redis connection URL (e.g. `redis://default:password@host:port`) |
| `AWS_ACCESS_KEY_ID` | Your S3 access key ID |
| `AWS_SECRET_ACCESS_KEY` | Your S3 secret access key |
| `AWS_STORAGE_BUCKET_NAME` | The target S3 bucket (e.g. `monteeq-2`) |
| `AWS_S3_REGION_NAME` | The S3 bucket region (e.g. `eu-central-1`) |
| `S3_ENDPOINT` | (Optional) Custom endpoint URL if not using AWS S3 (e.g., Backblaze B2, Cloudflare R2) |
| `AWS_S3_USE_ACCELERATE` | (Optional) Set to `true` to enable Transfer Acceleration |

## Deployment

To push changes to your Hugging Face Space:

1. Initialize git and configure the Hugging Face Space remote:
   ```bash
   git init
   git remote add hf git@hf.co:spaces/<your-username>/<your-space-name>
   ```
2. Commit and push:
   ```bash
   git add .
   git commit -m "Deploy to Hugging Face Spaces"
   git push hf main --force
   ```
