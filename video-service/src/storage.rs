use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::Client;
use aws_sdk_s3::primitives::ByteStream;
use anyhow::{Result, anyhow};
use std::path::Path;
use tokio::fs;

pub struct StorageManager {
    client: Client,
    bucket: String,
}

use aws_config::Region;

impl StorageManager {
    pub async fn new() -> Result<Self> {
        let region_name = std::env::var("S3_REGION").ok()
            .or_else(|| std::env::var("AWS_S3_REGION_NAME").ok())
            .or_else(|| std::env::var("AWS_REGION").ok());
        
        let region_provider = RegionProviderChain::first_try(region_name.map(Region::new))
            .or_default_provider()
            .or_else(Region::new("eu-west-1"));

        let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(region_provider)
            .load()
            .await;
        
        let mut s3_config_builder = aws_sdk_s3::config::Builder::from(&config);
        
        // Custom endpoint only when non-empty (empty S3_ENDPOINT → native AWS)
        if let Ok(endpoint) = std::env::var("S3_ENDPOINT") {
            let endpoint = endpoint.trim().to_string();
            if !endpoint.is_empty() {
                println!("Rust: Using custom S3 endpoint: {}", endpoint);
                s3_config_builder = s3_config_builder.endpoint_url(endpoint.clone());
                if !endpoint.contains("amazonaws.com") {
                    println!("Rust: Enabling force_path_style for custom endpoint");
                    s3_config_builder = s3_config_builder.force_path_style(true);
                }
            }
        }

        // Build S3 config with optional Transfer Acceleration
        let use_accelerate = std::env::var("AWS_S3_USE_ACCELERATE")
            .map(|v| v.to_lowercase() == "true")
            .unwrap_or(false);
            
        if use_accelerate {
            println!("Rust: Enabling S3 Transfer Acceleration");
            s3_config_builder = s3_config_builder.accelerate(true);
        }
        
        let s3_config = s3_config_builder.build();
        let client = Client::from_conf(s3_config);
        
        let bucket = std::env::var("AWS_STORAGE_BUCKET_NAME")
            .or_else(|_| std::env::var("S3_BUCKET_NAME"))
            .map_err(|_| anyhow!("Storage bucket name not set (AWS_STORAGE_BUCKET_NAME or S3_BUCKET_NAME)"))?;
        
        Ok(Self { client, bucket })
    }


    /// Recursively upload HLS directory to S3
    pub async fn upload_hls_dir(&self, local_dir: &str, s3_prefix: &str) -> Result<()> {
        let mut entries = fs::read_dir(local_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.is_file() {
                let filename = path.file_name().unwrap().to_str().unwrap();
                let key = format!("{}/{}", s3_prefix, filename);
                self.upload_file(&path, &key).await?;
            }
        }
        Ok(())
    }

    pub async fn upload_file(&self, local_path: &Path, key: &str) -> Result<()> {
        let data = fs::read(local_path).await?;
        let mime_type = match local_path.extension().and_then(|s| s.to_str()) {
            Some("m3u8") => "application/x-mpegURL",
            Some("ts") => "video/MP2T",
            Some("jpg") | Some("jpeg") => "image/jpeg",
            _ => "application/octet-stream",
        };

        let body = ByteStream::from(data);

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(body)
            .content_type(mime_type)
            .send()
            .await
            .map_err(|e| anyhow!("Upload failed: {}", e))?;

        Ok(())
    }

    /// List object keys under a given prefix.
    pub async fn list_objects(&self, prefix: &str) -> Result<Vec<String>> {
        let mut keys = Vec::new();
        let mut continuation_token: Option<String> = None;

        loop {
            let mut req = self.client
                .list_objects_v2()
                .bucket(&self.bucket)
                .prefix(prefix);

            if let Some(ref token) = continuation_token {
                req = req.continuation_token(token);
            }

            let resp = req.send().await
                .map_err(|e| anyhow!("List objects failed: {}", e))?;

            if let Some(contents) = resp.contents {
                for obj in contents {
                    if let Some(key) = obj.key {
                        keys.push(key);
                    }
                }
            }

            if resp.is_truncated.unwrap_or(false) {
                continuation_token = resp.next_continuation_token;
            } else {
                break;
            }
        }

        Ok(keys)
    }

    pub async fn download_file(&self, key: &str, local_path: &Path) -> Result<()> {
        println!("Attempting to download from S3: bucket={}, key={}", self.bucket, key);
        let res = self.client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| {
                let service_err = e.into_service_error();
                anyhow!("S3 Download Error [Bucket: {}, Key: {}]: {}", self.bucket, key, service_err)
            })?;

        let data = res.body.collect().await
            .map_err(|e| anyhow!("Failed to collect body: {}", e))?
            .into_bytes();

        fs::write(local_path, data).await?;
        Ok(())
    }
}
