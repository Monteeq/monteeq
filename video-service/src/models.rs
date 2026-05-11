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
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TaskStatus {
    pub progress: u32,
    pub status: String,
    pub message: String,
}
