use std::sync::Arc;
use tokio::sync::Semaphore;
use sysinfo::{System, SystemExt};
use crate::queue::WeightedScheduler;
use crate::transcoder;
use crate::ax_status::StatusMap;
use crate::models::TaskStatus;

pub struct WorkerPool {
    scheduler: WeightedScheduler,
    semaphore: Arc<Semaphore>,
    status_map: StatusMap,
}

impl WorkerPool {
    pub fn new(scheduler: WeightedScheduler, status_map: StatusMap) -> Self {
        let max_procs = calculate_max_processes();
        println!("Initializing Worker Pool with {} slots", max_procs);
        
        Self {
            scheduler,
            semaphore: Arc::new(Semaphore::new(max_procs)),
            status_map,
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
                    let smap = self.status_map.clone();
                    
                    tokio::spawn(async move {
                        let _permit = permit; // Hold permit until done
                        let task_id = task.task_id.clone();
                        let s3_key = task.video_id.clone(); 
                        let tier = task.tier.clone();
                        let target_format = task.target_format.clone();
                        let skip_thumbnail = task.skip_thumbnail;

                        // Phase 0: Download from S3
                        let storage = match crate::storage::StorageManager::new().await {
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
                            smap.insert(task_id.clone(), TaskStatus {
                                progress: 0,
                                status: "error".to_string(),
                                message: format!("Download failed: {}", e),
                            });
                            return; 
                        }

                        // Phase 1: Processing with retries
                        for attempt in 1..=3 {
                            if attempt > 1 { println!("Retrying {} (Attempt {})", task_id, attempt); }

                            let res = transcoder::process(
                                task_id.clone(),
                                &temp_path, 
                                &target_format, 
                                tier.clone(), 
                                skip_thumbnail, 
                                Some(smap.clone()), 
                                task_id.clone()
                            ).await;

                            match res {
                                Ok(_) => {
                                    println!("Completed Task: {}", task_id);
                                    smap.insert(task_id.clone(), TaskStatus {
                                        progress: 100,
                                        status: "completed".to_string(),
                                        message: "Success".to_string(),
                                    });
                                    break;
                                },
                                Err(e) if attempt == 3 => {
                                    eprintln!("Failed Task {} after 3 attempts: {}", task_id, e);
                                    smap.insert(task_id.clone(), TaskStatus {
                                        progress: 0,
                                        status: "error".to_string(),
                                        message: format!("Final error: {}", e),
                                    });
                                },
                                Err(_) => {
                                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                                }
                            }
                        }
                    });
                },
                Err(_) => {
                    // No tasks or wait timeout
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                }
            }
        }
    }
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
