use std::sync::Arc;
use axum::{
    routing::{post, get},
    extract::{Json, Path, State}, Router,
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use dotenvy::dotenv;
use std::env;
use fred::prelude::*;

mod transcoder;
mod ax_status;
mod worker;
mod models;
mod queue;
mod storage;

use models::{VideoTask, UserTier, TaskStatus};
use queue::WeightedScheduler;
use worker::WorkerPool;
use ax_status::StatusMap;

#[derive(serde::Serialize, serde::Deserialize)]
struct ProcessRequest {
    video_id: String,
    task_id: String,
    target_format: String,
    #[serde(default)]
    tier: UserTier,
    #[serde(default)]
    skip_thumbnail: bool,
}

struct AppState {
    scheduler: WeightedScheduler,
}

#[tokio::main]
async fn main() {
    dotenv().ok();

    // Redis Setup - Highly optimized for limited connections
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let mut config = RedisConfig::from_url(&redis_url).unwrap();
    
    // Disable any features that might open extra connections
    config.fail_fast = true;
    
    let perf = PerformanceConfig {
        // Ensure we only use 1 connection and set a 5s timeout
        default_command_timeout: std::time::Duration::from_secs(5),
        ..Default::default()
    };
    
    let policy = ReconnectPolicy::default();
    // RedisClient::new(config, performance, connection, policy)
    let client = RedisClient::new(config, Some(perf), None, Some(policy));
    
    client.connect();
    client.wait_for_connect().await.expect("Failed to connect to Redis Cloud");

    let scheduler = WeightedScheduler::new(client);
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

    let addr = SocketAddr::from(([0, 0, 0, 0], 8081));
    println!("Monteeq High-Performance Video Service listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn process_video(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ProcessRequest>
) -> Json<serde_json::Value> {
    let task = VideoTask {
        video_id: payload.video_id,
        task_id: payload.task_id.clone(),
        target_format: payload.target_format,
        tier: payload.tier,
        skip_thumbnail: payload.skip_thumbnail,
    };

    let status = TaskStatus {
        progress: 0,
        status: "queued".to_string(),
        message: "Task added to priority queue".to_string(),
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
            });
            Json(Some(status))
        },
        None => Json(None)
    }
}
