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
    status_map: StatusMap,
    scheduler: WeightedScheduler,
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    let status_map = Arc::new(dashmap::DashMap::new());

    // Redis Setup - Highly optimized for limited connections
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let mut config = RedisConfig::from_url(&redis_url).unwrap();
    
    // Disable any features that might open extra connections
    config.fail_fast = true;
    
    let perf = PerformanceConfig {
        // Ensure we only use 1 connection and set a 5s timeout
        default_command_timeout: std::time::Duration::from_millis(5000),
        ..Default::default()
    };
    
    let policy = ReconnectPolicy::default();
    let client = RedisClient::new(config, Some(perf), None, Some(policy));
    
    client.connect();
    client.wait_for_connect().await.expect("Failed to connect to Redis Cloud");

    let scheduler = WeightedScheduler::new(client);
    let worker_pool = WorkerPool::new(scheduler.clone(), status_map.clone());

    // Start prioritized worker pool
    tokio::spawn(async move {
        worker_pool.start().await;
    });

    let state = Arc::new(AppState { 
        status_map: status_map.clone(),
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

    state.status_map.insert(payload.task_id.clone(), TaskStatus {
        progress: 0,
        status: "queued".to_string(),
        message: "Task added to priority queue".to_string(),
    });

    // Push to weighted queue
    match state.scheduler.push_task(task).await {
        Ok(_) => {
            Json(serde_json::json!({
                "status": "accepted",
                "task_id": payload.task_id
            }))
        },
        Err(e) => {
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
    Json(state.status_map.get(&task_id).map(|s| s.value().clone()))
}
