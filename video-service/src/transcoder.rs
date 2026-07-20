use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use fred::interfaces::KeysInterface;
use anyhow::{Result, anyhow};
use std::path::Path;
use std::process::Stdio;
use std::time::{Duration, Instant};
use tokio::fs;
use crate::storage::StorageManager;
use crate::models::{UserTier, TaskStatus};
use crate::queue::WeightedScheduler;

/// Redis key TTL for live encode progress (seconds).
const JOB_PROGRESS_TTL_SECS: i64 = 300;
/// Minimum gap between progress Redis writes.
const PROGRESS_REPORT_INTERVAL: Duration = Duration::from_secs(1);

pub struct TranscodingConfig {
    pub preset: String,
    pub max_height: i32,
    pub crf: String,
}

impl TranscodingConfig {
    pub fn for_tier(tier: &UserTier) -> Self {
        match tier {
            UserTier::Free => Self {
                preset: "ultrafast".to_string(),
                max_height: 720,
                crf: "26".to_string(), // Slightly lower quality for space/speed
            },
            UserTier::Pro => Self {
                preset: "medium".to_string(),
                max_height: 2160, // Support up to 4K
                crf: "23".to_string(), // Better quality
            },
        }
    }
}

fn job_progress_key(job_id: &str) -> String {
    format!("job:progress:{}", job_id)
}

/// Write live encode progress `0..=100` to `job:progress:{job_id}` (fred Redis client).
pub async fn set_job_progress(sched: &WeightedScheduler, job_id: &str, percent: u32) {
    let pct = percent.min(100);
    let _: () = sched
        .client()
        .set(
            job_progress_key(job_id),
            pct.to_string(),
            Some(fred::types::Expiration::EX(JOB_PROGRESS_TTL_SECS)),
            None,
            false,
        )
        .await
        .unwrap_or_default();
}

/// Remove progress key so failed jobs do not leave a stale percentage.
pub async fn clear_job_progress(sched: &WeightedScheduler, job_id: &str) {
    let _: () = sched
        .client()
        .del(job_progress_key(job_id))
        .await
        .unwrap_or_default();
}

pub async fn process(
    _video_id: String, // Platform ID
    video_path: &str, // Local filesystem path
    format: &str,
    tier: UserTier,
    skip_thumbnail: bool,
    scheduler: Option<WeightedScheduler>,
    task_id: String, // Processing Key (= job_id for progress Redis key)
) -> Result<()> {
    println!("Starting processing for task_id={} video_path={}", task_id, video_path);

    // Check if file exists
    if !Path::new(video_path).exists() {
        return Err(anyhow!("Video file not found at path: {}", video_path));
    }

    let config = TranscodingConfig::for_tier(&tier);

    // 1. Metadata extraction
    if let Some(ref sched) = scheduler {
        let status = TaskStatus {
            progress: 5,
            status: "processing".to_string(),
            message: "Analyzing video streams and metadata...".to_string(),
            cover_url: None,
            cover_source: None,
        };
        let status_json = serde_json::to_string(&status).unwrap();
        let _: () = sched
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
    println!("Extracting metadata for {}", video_path);
    let (width, height, has_audio, duration_secs) = match get_video_metadata(video_path).await {
        Ok(m) => m,
        Err(e) => {
            eprintln!("Metadata extraction failed for {}: {}", video_path, e);
            if let Some(ref sched) = scheduler {
                clear_job_progress(sched, &task_id).await;
            }
            return Err(e);
        }
    };
    let aspect_ratio = width / height;
    println!(
        "Metadata: width={} height={} has_audio={} duration={:.3}s aspect_ratio={}",
        width, height, has_audio, duration_secs, aspect_ratio
    );

    // 2. Prep Output
    let output_dir = format!("{}_hls", video_path);
    if !Path::new(&output_dir).exists() {
        fs::create_dir_all(&output_dir).await?;
    }

    // 3. Transcode + Thumbnail Concurrently
    let transcoding_fut = transcode_tiered(
        video_path,
        &output_dir,
        format,
        &config,
        scheduler.clone(),
        task_id.clone(),
        has_audio,
        &tier,
        duration_secs,
    );
    let v_path = video_path.to_string();
    let thumbnail_fut = async move {
        if !skip_thumbnail {
            generate_thumbnail(&v_path).await
        } else {
            Ok(())
        }
    };

    // Run both. Pro users might benefit from faster total completion time
    let (trans_res, thumb_res) = tokio::join!(transcoding_fut, thumbnail_fut);

    match (&trans_res, &thumb_res) {
        (Ok(()), Ok(())) => {}
        _ => {
            if let Some(ref sched) = scheduler {
                clear_job_progress(sched, &task_id).await;
            }
            trans_res?;
            thumb_res?;
        }
    }

    // 4. Upload to Storage
    match StorageManager::new().await {
        Ok(storage) => {
            let s3_prefix = format!("videos/{}", task_id);
            if let Some(ref sched) = scheduler {
                let status = TaskStatus {
                    progress: 90,
                    status: "processing".to_string(),
                    message: "Syncing video segments to edge nodes...".to_string(),
                    cover_url: None,
                    cover_source: None,
                };
                let status_json = serde_json::to_string(&status).unwrap();
                let _: () = sched
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
            storage.upload_hls_dir(&output_dir, &s3_prefix).await?;

            // Upload thumbnail too
            if !skip_thumbnail {
                let thumb_path = format!("{}.jpg", video_path);
                let thumb_key = format!("thumbnails/{}.jpg", task_id);
                storage.upload_file(Path::new(&thumb_path), &thumb_key).await?;
            }
        }
        Err(e) => {
            eprintln!("Storage Manager initialization failed: {}. Skipping upload.", e);
            if let Some(ref sched) = scheduler {
                clear_job_progress(sched, &task_id).await;
            }
            return Err(anyhow!("Storage initialization failed: {}", e));
        }
    }
    Ok(())
}

/// Probe width/height, audio presence, and total duration (seconds).
/// Duration comes from format context (`format=duration`), with stream duration as fallback —
/// equivalent to reading container duration / stream time_base×duration in ffmpeg-next.
async fn get_video_metadata(video_path: &str) -> Result<(i32, i32, bool, f64)> {
    let output = Command::new("ffprobe")
        .args(&[
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=s=x:p=0",
            video_path,
        ])
        .output()
        .await?;

    let s = String::from_utf8(output.stdout)?;
    let parts: Vec<&str> = s.trim().split('x').collect();
    if parts.len() != 2 {
        return Err(anyhow!("Invalid ffprobe output: {}", s));
    }

    let width = parts[0].parse()?;
    let height = parts[1].parse()?;

    // Check for audio
    let audio_output = Command::new("ffprobe")
        .args(&[
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=index",
            "-of",
            "csv=p=0",
            video_path,
        ])
        .output()
        .await?;

    let has_audio = !String::from_utf8(audio_output.stdout)?.trim().is_empty();

    let duration_secs = get_video_duration_secs(video_path).await.unwrap_or(0.0);

    Ok((width, height, has_audio, duration_secs))
}

async fn get_video_duration_secs(video_path: &str) -> Result<f64> {
    // Prefer container / format duration (same source as AVFormatContext.duration).
    let format_out = Command::new("ffprobe")
        .args(&[
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            video_path,
        ])
        .output()
        .await?;

    let format_s = String::from_utf8_lossy(&format_out.stdout).trim().to_string();
    if let Ok(d) = format_s.parse::<f64>() {
        if d.is_finite() && d > 0.0 {
            return Ok(d);
        }
    }

    // Fallback: stream duration (seconds) — akin to stream.duration * av_q2d(time_base).
    let stream_out = Command::new("ffprobe")
        .args(&[
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            video_path,
        ])
        .output()
        .await?;

    let stream_s = String::from_utf8_lossy(&stream_out.stdout).trim().to_string();
    let d: f64 = stream_s
        .parse()
        .map_err(|_| anyhow!("Invalid duration from ffprobe: format={:?} stream={:?}", format_s, stream_s))?;
    if !d.is_finite() || d <= 0.0 {
        return Err(anyhow!("Non-positive duration: {}", d));
    }
    Ok(d)
}

async fn transcode_tiered(
    input: &str,
    output_dir: &str,
    format: &str,
    config: &TranscodingConfig,
    scheduler: Option<WeightedScheduler>,
    task_id: String,
    has_audio: bool,
    tier: &UserTier,
    duration_secs: f64,
) -> Result<()> {
    println!("Transcoding tiered levels for {} -> {}", input, output_dir);

    let source_height = get_video_height(input).await?;
    let _target_height = source_height.min(config.max_height);

    // ── 1. Determine variants ────────────────────────────────────────────────
    // num_variants = how many video streams (and therefore audio streams) we produce.
    // stream_map uses unique a:N per variant — sharing a:0 across variants is the
    // root cause of FFmpeg error "Same elementary stream found more than once".
    let (filter, stream_map, num_variants): (String, String, usize) = if format == "flash" {
        // Single quality for flash (Original resolution)
        let sm = if has_audio {
            "v:0,a:0,name:original".to_string()
        } else {
            "v:0,name:original".to_string()
        };
        (format!("[0:v]scale=w=-2:h={}[vout]", source_height), sm, 1)
    } else if config.max_height <= 720 {
        // Free tier — two quality levels, capped at 720p
        let sm = if has_audio {
            "v:0,a:0,name:720p v:1,a:1,name:480p".to_string() // ← unique a:0 / a:1
        } else {
            "v:0,name:720p v:1,name:480p".to_string()
        };
        (
            "[0:v]split=2[v1][v2]; [v1]scale=w=-2:h=720[v1out]; [v2]scale=w=-2:h=480[v2out]".to_string(),
            sm,
            2,
        )
    } else {
        // Pro tier — three quality levels up to 1080p
        let sm = if has_audio {
            "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p".to_string() // ← unique a:0/a:1/a:2
        } else {
            "v:0,name:1080p v:1,name:720p v:2,name:480p".to_string()
        };
        (
            "[0:v]split=3[v1][v2][v3]; [v1]scale=w=-2:h=1080[v1out]; [v2]scale=w=-2:h=720[v2out]; [v3]scale=w=-2:h=480[v3out]".to_string(),
            sm,
            3,
        )
    };

    // ── 2. Build args as Vec<String> so we can push dynamic per-stream options ─
    let mut args: Vec<String> = vec![
        "-i".into(),
        input.into(),
        // NOTE: Do NOT add global -c:a here — it conflicts with per-stream -c:a:N below
        "-preset".into(),
        config.preset.clone(),
        "-crf".into(),
        config.crf.clone(),
        "-f".into(),
        "hls".into(),
        "-hls_time".into(),
        "6".into(),
        "-hls_playlist_type".into(),
        "vod".into(),
        "-master_pl_name".into(),
        "master.m3u8".into(),
        "-filter_complex".into(),
        filter.clone(),
    ];

    // ── 3. Video stream mappings ─────────────────────────────────────────────
    if filter.contains("split=3") {
        args.extend(
            [
                "-map", "[v1out]", "-c:v:0", "libx264", "-b:v:0", "5000k", "-map", "[v2out]",
                "-c:v:1", "libx264", "-b:v:1", "2800k", "-map", "[v3out]", "-c:v:2", "libx264",
                "-b:v:2", "1200k",
            ]
            .iter()
            .map(|s| s.to_string()),
        );
    } else if filter.contains("split=2") {
        args.extend(
            [
                "-map", "[v1out]", "-c:v:0", "libx264", "-b:v:0", "2800k", "-map", "[v2out]",
                "-c:v:1", "libx264", "-b:v:1", "1200k",
            ]
            .iter()
            .map(|s| s.to_string()),
        );
    } else {
        args.extend(
            ["-map", "[vout]", "-c:v:0", "libx264", "-b:v:0", "2800k"]
                .iter()
                .map(|s| s.to_string()),
        );
    }

    // ── 4. Audio stream mappings ─────────────────────────────────────────────
    // Each HLS variant needs its OWN audio output stream.  We map the single
    // source audio track N times (once per variant) so the muxer can write
    // independent AAC streams into the separate .ts segment files.
    if has_audio {
        for _ in 0..num_variants {
            args.push("-map".into());
            args.push("0:a?".into());
        }
        for i in 0..num_variants {
            args.push(format!("-c:a:{}", i));
            args.push("aac".into());
            args.push(format!("-b:a:{}", i));
            args.push("128k".into());
        }
    }

    // ── 5. HLS output options ────────────────────────────────────────────────
    let segment_filename = format!("{}/%v_%03d.ts", output_dir);
    let output_pattern = format!("{}/%v.m3u8", output_dir);

    args.extend([
        "-hls_segment_filename".to_string(),
        segment_filename,
        "-var_stream_map".to_string(),
        stream_map,
        output_pattern,
    ]);

    if let Some(ref sched) = scheduler {
        let status = TaskStatus {
            progress: 15,
            status: "processing".to_string(),
            message: format!("Compressing and optimizing video (Tier: {:?})", tier),
            cover_url: None,
            cover_source: None,
        };
        let status_json = serde_json::to_string(&status).unwrap();
        let _: () = sched
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
        set_job_progress(sched, &task_id, 0).await;
    }

    run_ffmpeg_with_progress(&args, duration_secs, scheduler.as_ref(), &task_id).await
}

/// Spawn ffmpeg with `-progress pipe:1`, map `out_time` → percent of input duration,
/// and throttle Redis writes to ~1/sec on `job:progress:{job_id}`.
///
/// This is the CLI equivalent of walking PTS in an ffmpeg-next encode loop:
/// `progress = (pts * time_base / total_duration) * 100`.
async fn run_ffmpeg_with_progress(
    args: &[String],
    duration_secs: f64,
    scheduler: Option<&WeightedScheduler>,
    task_id: &str,
) -> Result<()> {
    // Machine-readable progress on stdout; keep stderr for errors (drained so the pipe never blocks).
    let mut full_args: Vec<String> = vec![
        "-nostats".into(),
        "-progress".into(),
        "pipe:1".into(),
    ];
    full_args.extend(args.iter().cloned());

    let mut child = Command::new("ffmpeg")
        .args(&full_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| anyhow!("ffmpeg stdout not captured"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| anyhow!("ffmpeg stderr not captured"))?;

    let stderr_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        let mut reader = BufReader::new(stderr);
        let _ = reader.read_to_end(&mut buf).await;
        String::from_utf8_lossy(&buf).to_string()
    });

    let mut lines = BufReader::new(stdout).lines();
    let mut last_report = Instant::now()
        .checked_sub(PROGRESS_REPORT_INTERVAL)
        .unwrap_or_else(Instant::now);
    let mut current_out_us: u64 = 0;

    while let Some(line) = lines.next_line().await? {
        let line = line.trim();
        if let Some(v) = line.strip_prefix("out_time_us=") {
            if let Ok(us) = v.parse::<u64>() {
                current_out_us = us;
            }
        } else if let Some(v) = line.strip_prefix("out_time_ms=") {
            // Historical ffmpeg key: value is microseconds despite the name.
            if let Ok(us) = v.parse::<u64>() {
                current_out_us = us;
            }
        } else if line.starts_with("progress=") {
            let force = line == "progress=end";
            if force || last_report.elapsed() >= PROGRESS_REPORT_INTERVAL {
                if duration_secs > 0.0 {
                    let current_time_seconds = current_out_us as f64 / 1_000_000.0;
                    // Cap at 99 until process exit confirms success (then we set 100).
                    let progress_percent =
                        ((current_time_seconds / duration_secs) * 100.0).clamp(0.0, 99.0) as u32;
                    if let Some(sched) = scheduler {
                        set_job_progress(sched, task_id, progress_percent).await;
                    }
                }
                last_report = Instant::now();
            }
        }
    }

    let status = child.wait().await?;
    let err_text = stderr_task.await.unwrap_or_default();

    if !status.success() {
        eprintln!("FFmpeg Error: {}", err_text);
        if let Some(sched) = scheduler {
            clear_job_progress(sched, task_id).await;
        }
        return Err(anyhow!("FFmpeg failed: {}", err_text));
    }

    if let Some(sched) = scheduler {
        set_job_progress(sched, task_id, 100).await;
    }
    Ok(())
}

async fn get_video_height(input: &str) -> Result<i32> {
    let output = Command::new("ffprobe")
        .args(&[
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=height",
            "-of",
            "csv=p=0",
            input,
        ])
        .output()
        .await?;
    let s = String::from_utf8(output.stdout)?;
    Ok(s.trim().parse()?)
}

async fn generate_thumbnail(video_path: &str) -> Result<()> {
    // Legacy path (thumbnails next to source). Prefer generate_and_upload_auto_cover.
    let thumb_path = format!("{}.jpg", video_path);
    extract_cover_frame(video_path, &thumb_path, 0.1).await
}

/// Seek ~`pct` into the video (default 10%) and write a single JPEG frame.
/// Uses the system ffmpeg CLI (same stack as the rest of this service; equivalent
/// to grabbing a decoded frame via ffmpeg-next around that timestamp).
pub async fn extract_cover_frame(video_path: &str, out_jpg: &str, pct: f64) -> Result<()> {
    let duration = match get_video_metadata(video_path).await {
        Ok((_, _, _, d)) if d.is_finite() && d > 0.0 => d,
        _ => 0.0,
    };
    let seek_secs = if duration > 0.5 {
        (duration * pct).clamp(0.0, (duration - 0.05).max(0.0))
    } else {
        0.0
    };
    let seek_arg = format!("{:.3}", seek_secs);

    println!(
        "Extracting cover frame from {} at {}s ({:.0}% of {:.2}s) → {}",
        video_path,
        seek_arg,
        pct * 100.0,
        duration,
        out_jpg
    );

    let status = Command::new("ffmpeg")
        .args(&[
            "-ss",
            &seek_arg,
            "-i",
            video_path,
            "-frames:v",
            "1",
            "-update",
            "1",
            "-q:v",
            "2",
            "-y",
            out_jpg,
        ])
        .status()
        .await?;
    if !status.success() {
        return Err(anyhow!("Cover frame extraction failed"));
    }
    if !Path::new(out_jpg).exists() {
        return Err(anyhow!("Cover JPEG was not written: {}", out_jpg));
    }
    Ok(())
}

/// Auto cover: frame at ~10% duration → JPEG → S3 `covers/{task_id}.jpg`.
/// Returns the S3 key for inclusion in the Redis completion payload.
pub async fn generate_and_upload_auto_cover(
    video_path: &str,
    task_id: &str,
    storage: &StorageManager,
) -> Result<String> {
    let cover_local = format!("{}_cover.jpg", video_path);
    extract_cover_frame(video_path, &cover_local, 0.1).await?;

    let cover_key = format!("covers/{}.jpg", task_id);
    storage
        .upload_file(Path::new(&cover_local), &cover_key)
        .await?;

    // Best-effort cleanup of local JPEG
    let _ = fs::remove_file(&cover_local).await;

    println!("Auto cover uploaded: {}", cover_key);
    Ok(cover_key)
}
