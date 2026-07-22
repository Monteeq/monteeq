use std::sync::Arc;
use tokio::sync::Semaphore;
use sysinfo::{System, SystemExt};
use crate::queue::WeightedScheduler;
use fred::interfaces::KeysInterface;
use crate::transcoder;
use crate::models::{TaskStatus, VideoTask};
use crate::storage::StorageManager;

pub struct WorkerPool {
    scheduler: WeightedScheduler,
    semaphore: Arc<Semaphore>,
}

impl WorkerPool {
    pub fn new(scheduler: WeightedScheduler) -> Self {
        let max_procs = calculate_max_processes();
        println!("Initializing Worker Pool with {} slots", max_procs);

        Self {
            scheduler,
            semaphore: Arc::new(Semaphore::new(max_procs)),
        }
    }

    pub async fn start(&self) {
        println!("Worker Pool started. Polling for tasks...");

        loop {
            // Wait for a slot to be available before even pulling a task
            // This prevents filling RAM with tasks that are just waiting
            let permit = self.semaphore.clone().acquire_owned().await.unwrap();

            match self.scheduler.next_task().await {
                Ok(task) => {
                    let scheduler = self.scheduler.clone();

                    tokio::spawn(async move {
                        let _permit = permit; // Hold permit until done
                        process_video_job(scheduler, task).await;
                    });
                }
                Err(_) => {
                    // No tasks or wait timeout
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                }
            }
        }
    }
}

/// Process one queued video job end-to-end:
/// download → transcode → resolve cover (custom pass-through or auto-generate) → Redis status.
async fn process_video_job(scheduler: WeightedScheduler, task: VideoTask) {
    let task_id = task.task_id.clone();
    let s3_key = task.video_id.clone();
    let tier = task.tier.clone();
    let target_format = task.target_format.clone();

    // 1) cover_source from payload — missing/empty ⇒ "auto" (backward compatible)
    let cover_source = {
        let raw = task.cover_source.trim().to_lowercase();
        if raw.is_empty() {
            "auto".to_string()
        } else {
            raw
        }
    };
    let cover_s3_key = task.cover_s3_key.clone();
    let is_custom = cover_source == "custom";

    let storage = match StorageManager::new().await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to initialize StorageManager for task {}: {}", task_id, e);
            return;
        }
    };

    let temp_file = match tempfile::NamedTempFile::new() {
        Ok(f) => f,
        Err(e) => {
            eprintln!("Failed to create temp file for task {}: {}", task_id, e);
            return;
        }
    };
    let temp_path = temp_file.path().to_str().unwrap().to_string();

    println!("Downloading {} from S3 to {}", s3_key, temp_path);
    if let Err(e) = storage.download_file(&s3_key, temp_file.path()).await {
        eprintln!("Download failed for task {}: {}", task_id, e);
        write_task_status(
            &scheduler,
            &task_id,
            TaskStatus {
                progress: 0,
                status: "error".to_string(),
                message: format!("Download failed: {}", e),
                cover_url: None,
                cover_source: Some(cover_source.clone()),
            },
        )
        .await;
        return;
    }

    // Transcode only — cover handling is separate (skip legacy thumbnail/{task_id}.jpg path)
    for attempt in 1..=3 {
        if attempt > 1 {
            println!("Retrying {} (Attempt {})", task_id, attempt);
        }

        let res = transcoder::process(
            task_id.clone(),
            &temp_path,
            &target_format,
            tier.clone(),
            true, // always skip legacy concurrent thumb; we resolve cover below
            Some(scheduler.clone()),
            task_id.clone(),
        )
        .await;

        match res {
            Ok(()) => {
                println!(
                    "Completed transcode for task {} (cover_source={})",
                    task_id, cover_source
                );
                transcoder::set_job_progress(&scheduler, &task_id, 100).await;

                // 2–3) Resolve cover_url
                let cover_url = if is_custom {
                    // Custom: no generation — pass through already-uploaded S3 key
                    let key = cover_s3_key.clone().unwrap_or_else(|| {
                        format!("covers/{}.jpg", task_id)
                    });
                    println!("Using custom cover (skip generation): {}", key);
                    key
                } else {
                    // Auto (or missing): extract ~10% frame, JPEG, upload covers/{task_id}.jpg
                    match transcoder::generate_and_upload_auto_cover(
                        &temp_path,
                        &task_id,
                        &storage,
                    )
                    .await
                    {
                        Ok(key) => key,
                        Err(e) => {
                            eprintln!(
                                "Auto cover generation failed for {}: {} — marking error",
                                task_id, e
                            );
                            transcoder::clear_job_progress(&scheduler, &task_id).await;
                            write_task_status(
                                &scheduler,
                                &task_id,
                                TaskStatus {
                                    progress: 0,
                                    status: "error".to_string(),
                                    message: format!("Cover generation failed: {}", e),
                                    cover_url: None,
                                    cover_source: Some(cover_source.clone()),
                                },
                            )
                            .await;
                            return;
                        }
                    }
                };

                // 4) Completion payload for Celery /status consumers
                write_task_status(
                    &scheduler,
                    &task_id,
                    TaskStatus {
                        progress: 100,
                        status: "completed".to_string(),
                        message: "Video live and distributed globally!".to_string(),
                        cover_url: Some(cover_url),
                        cover_source: Some(cover_source.clone()),
                    },
                )
                .await;
                break;
            }
            Err(e) if attempt == 3 => {
                eprintln!("Failed Task {} after 3 attempts: {}", task_id, e);
                transcoder::clear_job_progress(&scheduler, &task_id).await;
                write_task_status(
                    &scheduler,
                    &task_id,
                    TaskStatus {
                        progress: 0,
                        status: "error".to_string(),
                        message: format!("Final error: {}", e),
                        cover_url: None,
                        cover_source: Some(cover_source.clone()),
                    },
                )
                .await;
            }
            Err(_) => {
                transcoder::clear_job_progress(&scheduler, &task_id).await;
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            }
        }
    }
}

async fn write_task_status(scheduler: &WeightedScheduler, task_id: &str, status: TaskStatus) {
    let status_json = serde_json::to_string(&status).unwrap_or_else(|_| {
        r#"{"progress":0,"status":"error","message":"serialize failed"}"#.to_string()
    });
    let _: () = scheduler
        .client()
        .set(
            format!("task:status:{}", task_id),
            status_json,
            Some(fred::types::Expiration::EX(86400)),
            None,
            false,
        )
        .await
        .unwrap_or_default();
}

fn calculate_max_processes() -> usize {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpus = sys.cpus().len();
    let total_ram_gb = sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);

    // Formula: min(cpus/2, ram/1.5, disk_limit)
    let cpu_limit = (cpus as f64 / 2.0).floor() as usize;
    let ram_limit = (total_ram_gb / 1.5).floor() as usize;
    let disk_limit = std::env::var("DISK_IO_LIMIT")
        .unwrap_or_else(|_| "4".to_string())
        .parse::<usize>()
        .unwrap_or(4);

    let calculated = cpu_limit.min(ram_limit).min(disk_limit);

    // Ensure at least 1 worker
    calculated.max(1)
}
