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

- **Health Check**: [/health](https://monteeqorg-readme.hf.space/health)

## Configuration

In your Hugging Face Space settings, add the following **Secrets**:

| Secret Name | Value |
|---|---|
| `REDIS_URL` | Redis Cloud connection URL |
| `S3_ENDPOINT` | `https://s3.hf.co/MonteeqOrg` |
| `S3_BUCKET_NAME` | `backend-storage` |
| `AWS_ACCESS_KEY_ID` | HF S3 Access Key |
| `AWS_SECRET_ACCESS_KEY` | HF S3 Secret Key |
| `AWS_S3_REGION_NAME` | `us-east-1` |
| `AWS_CLOUDFRONT_DOMAIN` | *(leave empty)* |
