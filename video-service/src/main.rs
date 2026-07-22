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
