use std::sync::Arc;
use axum::{
    routing::{post, get},
    extract::{Json, Path, State}, Router,
};
// use std::net::SocketAddr; // Removed unused import
use tower_http::cors::CorsLayer;
use dotenvy::dotenv;
use std::env;
use fred::prelude::*;
use fred::interfaces::KeysInterface;
use std::path::Path as StdPath;

mod transcoder;
mod worker;
mod models;
mod queue;
mod storage;

use models::{VideoTask, UserTier, TaskStatus};
use queue::WeightedScheduler;
use worker::WorkerPool;

#[derive(serde::Serialize, serde::Deserialize)]
struct ProcessRequest {
    video_id: String,
    task_id: String,
    target_format: String,
    #[serde(default)]
    tier: UserTier,
    #[serde(default)]
    skip_thumbnail: bool,
    #[serde(default = "default_cover_source", alias = "coverSource")]
    cover_source: String,
    #[serde(default, alias = "coverS3Key")]
    cover_s3_key: Option<String>,
}

fn default_cover_source() -> String {
    "auto".to_string()
}

#[derive(serde::Deserialize)]
struct PreviewRequest {
    source_prefix: String,
    task_id: String,
}

struct AppState {
    scheduler: WeightedScheduler,
}

#[tokio::main]
async fn main() {
    dotenv().ok();

    // We bind the port first so Render doesn't time out while we connect to Redis
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.expect("Failed to bind to PORT");
    println!("Monteeq High-Performance Video Service listening on {}", addr);

    // Redis Setup - Highly optimized for limited connections
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let mut config = RedisConfig::from_url(&redis_url).unwrap();
    
    // Allow for connection retries and higher throughput
    config.fail_fast = false;
    
    let perf = PerformanceConfig {
        // Increase timeout and allow more concurrent operations
        default_command_timeout: std::time::Duration::from_secs(30),
        ..Default::default()
    };
    
    let policy = ReconnectPolicy::default();
    // Small pool — Redis Cloud free tier caps ~30 clients shared with backend/Celery
    let pool = RedisPool::new(config, Some(perf), None, Some(policy), 3).unwrap();
    
    println!("[DEBUG] Initiating Redis connection to {}...", redis_url);
    pool.connect();
    // We don't wait_for_connect() here to avoid blocking Render's port detection.
    // Fred will automatically queue commands until the connection is established.
    println!("[DEBUG] Redis connection task initiated.");

    let scheduler = WeightedScheduler::new(pool);
    let worker_pool = WorkerPool::new(scheduler.clone());

    // Start prioritized worker pool
    tokio::spawn(async move {
        worker_pool.start().await;
    });

    let state = Arc::new(AppState { 
        scheduler: scheduler.clone(),
    });

    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/process", post(process_video))
        .route("/preview", post(generate_preview))
        .route("/status/:task_id", get(get_status))
        .layer(CorsLayer::permissive())
        .with_state(state);

    axum::serve(listener, app).await.unwrap();
}

async fn process_video(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ProcessRequest>
) -> Json<serde_json::Value> {
    let cover_source = if payload.cover_source.trim().is_empty() {
        if payload.skip_thumbnail { "custom".to_string() } else { "auto".to_string() }
    } else {
        payload.cover_source.clone()
    };

    let task = VideoTask {
        video_id: payload.video_id,
        task_id: payload.task_id.clone(),
        target_format: payload.target_format,
        tier: payload.tier,
        skip_thumbnail: payload.skip_thumbnail || cover_source == "custom",
        cover_source: cover_source.clone(),
        cover_s3_key: payload.cover_s3_key.clone(),
    };

    let status = TaskStatus {
        progress: 0,
        status: "queued".to_string(),
        message: "Task added to priority queue".to_string(),
        cover_url: None,
        cover_source: Some(cover_source),
    };

    // Save status to Redis with 24h TTL
    let status_json = serde_json::to_string(&status).unwrap();
    let status_key = format!("task:status:{}", payload.task_id);
    let _: () = state.scheduler.client().set(status_key, status_json, Some(Expiration::EX(86400)), None, false).await.unwrap_or_default();

    // Push to weighted queue
    match state.scheduler.push_task(task).await {
        Ok(_) => {
            println!("[UPLOAD] Task accepted: {}", payload.task_id);
            Json(serde_json::json!({
                "status": "accepted",
                "task_id": payload.task_id
            }))
        },
        Err(e) => {
            eprintln!("[ERROR] Failed to push task {}: {}", payload.task_id, e);
            Json(serde_json::json!({
                "status": "error",
                "message": e.to_string()
            }))
        }
    }
}

async fn get_status(
    State(state): State<Arc<AppState>>,
    Path(task_id): Path<String>
) -> Json<Option<TaskStatus>> {
    let status_key = format!("task:status:{}", task_id);
    let val: Option<String> = state.scheduler.client().get(status_key).await.unwrap_or(None);
    
    match val {
        Some(json) => {
            let status: TaskStatus = serde_json::from_str(&json).unwrap_or(TaskStatus {
                progress: 0,
                status: "error".to_string(),
                message: "Failed to parse status".to_string(),
                cover_url: None,
                cover_source: None,
            });
            Json(Some(status))
        },
        None => Json(None)
    }
}

async fn generate_preview(
    Json(payload): Json<PreviewRequest>,
) -> Json<serde_json::Value> {
    let storage = match storage::StorageManager::new().await {
        Ok(s) => s,
        Err(e) => {
            return Json(serde_json::json!({
                "status": "error",
                "message": format!("Storage init failed: {}", e)
            }));
        }
    };

    // List source files under uploads/{task_id}/
    let prefix = if payload.source_prefix.ends_with('/') {
        payload.source_prefix.clone()
    } else {
        format!("{}/", payload.source_prefix)
    };

    let keys = match storage.list_objects(&prefix).await {
        Ok(k) => k,
        Err(e) => {
            return Json(serde_json::json!({
                "status": "error",
                "message": format!("List objects failed: {}", e)
            }));
        }
    };

    // Find the source video file (largest non-thumb, non-cover file)
    let source_key = keys.iter()
        .filter(|k| {
            let lower = k.to_lowercase();
            !lower.ends_with(".jpg") && !lower.ends_with(".jpeg") && !lower.ends_with(".png") && !lower.ends_with(".webp")
        })
        .max_by_key(|k| k.len())
        .cloned();

    let source_key = match source_key {
        Some(k) => k,
        None => {
            return Json(serde_json::json!({
                "status": "error",
                "message": format!("No source video found under {}", prefix)
            }));
        }
    };

    // Download source to temp file
    let temp_file = match tempfile::NamedTempFile::new() {
        Ok(f) => f,
        Err(e) => {
            return Json(serde_json::json!({
                "status": "error",
                "message": format!("Temp file failed: {}", e)
            }));
        }
    };

    if let Err(e) = storage.download_file(&source_key, temp_file.path()).await {
        return Json(serde_json::json!({
            "status": "error",
            "message": format!("Download failed: {}", e)
        }));
    }

    let source_path = temp_file.path().to_str().unwrap().to_string();

    // Probe duration
    let (_w, _h, _audio, duration) = match transcoder::get_video_metadata(&source_path).await {
        Ok(m) => m,
        Err(e) => {
            return Json(serde_json::json!({
                "status": "error",
                "message": format!("Metadata probe failed: {}", e)
            }));
        }
    };

    // Generate preview clip
    let preview_local = format!("{}_preview.mp4", source_path);
    if let Err(e) = transcoder::generate_preview_clip(&preview_local, &source_path, duration).await {
        return Json(serde_json::json!({
            "status": "error",
            "message": format!("Preview generation failed: {}", e)
        }));
    }

    let preview_path = StdPath::new(&preview_local);
    if !preview_path.exists() {
        return Json(serde_json::json!({
            "status": "error",
            "message": "Preview clip file not found after generation".to_string()
        }));
    }

    // Upload preview to S3
    let preview_key = format!("previews/{}.mp4", payload.task_id);
    if let Err(e) = storage.upload_file(preview_path, &preview_key).await {
        let _ = tokio::fs::remove_file(&preview_local).await;
        return Json(serde_json::json!({
            "status": "error",
            "message": format!("Preview upload failed: {}", e)
        }));
    }

    let _ = tokio::fs::remove_file(&preview_local).await;
    println!("Preview clip generated and uploaded: {}", preview_key);

    Json(serde_json::json!({
        "status": "ok",
        "preview_key": preview_key
    }))
}
