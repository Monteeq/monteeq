use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum UserTier {
    #[default]
    Free,
    Pro,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VideoTask {
    pub video_id: String,
    pub task_id: String,
    pub target_format: String, // "home" or "flash"
    pub tier: UserTier,
    #[serde(default)]
    pub skip_thumbnail: bool,
    /// "auto" (Rust generates) or "custom" (client already uploaded cover)
    #[serde(default = "default_cover_source", alias = "coverSource")]
    pub cover_source: String,
    /// S3 key for a custom cover, e.g. thumbnails/{job_id}.jpg
    #[serde(default, alias = "coverS3Key")]
    pub cover_s3_key: Option<String>,
}

fn default_cover_source() -> String {
    "auto".to_string()
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TaskStatus {
    pub progress: u32,
    pub status: String,
    pub message: String,
    /// Public or storage-relative cover URL/key after processing
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_source: Option<String>,
}
