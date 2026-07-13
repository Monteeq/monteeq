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

In your Hugging Face Space settings, add the following **Secrets** (AWS S3 — match `backend/.env`):

| Secret Name | Value |
|---|---|
| `REDIS_URL` | Redis Cloud connection URL |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_STORAGE_BUCKET_NAME` | `monteeq-2` |
| `AWS_S3_REGION_NAME` | `eu-central-1` |
| `AWS_CLOUDFRONT_DOMAIN` | `cdn.monteeq.com` |

Leave `S3_ENDPOINT` unset (or empty) so the service uses native AWS S3.
