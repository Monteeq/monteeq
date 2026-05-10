use fred::prelude::*;
use crate::models::{VideoTask, UserTier};
use anyhow::{Result, anyhow};
use std::sync::Arc;
use tokio::sync::Mutex;

pub const QUEUE_PRO: &str = "tasks:pro";
pub const QUEUE_FREE: &str = "tasks:free";

#[derive(Clone)]
pub struct WeightedScheduler {
    client: RedisClient,
    pro_counter: Arc<Mutex<u32>>,
}

impl WeightedScheduler {
    pub fn new(client: RedisClient) -> Self {
        Self {
            client,
            pro_counter: Arc::new(Mutex::new(0)),
        }
    }

    pub fn client(&self) -> &RedisClient {
        &self.client
    }

    /// Fetches a task using a 70:30 weighted ratio (PRO:FREE).
    /// If both queues are empty, it waits (BRPOP) with a timeout.
    pub async fn next_task(&self) -> Result<VideoTask> {
        let mut pro_count = self.pro_counter.lock().await;

        // Determine which list to check first based on weights
        let (first, second) = if *pro_count < 3 {
            (QUEUE_PRO, QUEUE_FREE)
        } else {
            (QUEUE_FREE, QUEUE_PRO)
        };

        // 1. Try first choice (Non-blocking)
        if let Some(val) = self.try_pop(first).await? {
            if first == QUEUE_PRO { *pro_count += 1; } else { *pro_count = 0; }
            return Ok(serde_json::from_str(&val)?);
        }

        // 2. Try second choice (Non-blocking)
        if let Some(val) = self.try_pop(second).await? {
            if second == QUEUE_PRO { *pro_count += 1; } else { *pro_count = 0; }
            return Ok(serde_json::from_str(&val)?);
        }

        // 3. Fallback: Wait on both (Anti-starvation)
        // Note: fred's brpop on multiple keys picks the first available. 
        // We'll reset counts if we resort to waiting.
        let result: Option<(String, String)> = self.client.brpop(vec![QUEUE_PRO, QUEUE_FREE], 30.0).await?;
        
        if let Some((key, val)) = result {
            if key == QUEUE_PRO { *pro_count += 1; } else { *pro_count = 0; }
            return Ok(serde_json::from_str(&val)?);
        }

        Err(anyhow!("No tasks available"))
    }

    async fn try_pop(&self, key: &str) -> Result<Option<String>> {
        let val: Option<String> = self.client.lpop(key, None).await?;
        Ok(val)
    }

    pub async fn push_task(&self, task: VideoTask) -> Result<()> {
        let key = if task.tier == UserTier::Pro { QUEUE_PRO } else { QUEUE_FREE };
        let json = serde_json::to_string(&task)?;
        self.client.rpush::<(), _, _>(key, json).await?;
        Ok(())
    }
}
