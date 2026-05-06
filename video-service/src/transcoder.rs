use tokio::process::Command;
use anyhow::{Result, anyhow};
use std::path::Path;
use tokio::fs;
use crate::storage::StorageManager;
use crate::models::{UserTier, TaskStatus};
use crate::ax_status::StatusMap;

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

pub async fn process(
    _video_id: String, // Platform ID
    video_path: &str, // Local filesystem path
    format: &str, 
    tier: UserTier,
    skip_thumbnail: bool, 
    status_map: Option<StatusMap>, 
    task_id: String  // Processing Key
) -> Result<()> {
    println!("Starting processing for task_id={} video_path={}", task_id, video_path);
    
    // Check if file exists
    if !Path::new(video_path).exists() {
        return Err(anyhow!("Video file not found at path: {}", video_path));
    }

    let config = TranscodingConfig::for_tier(&tier);
    
    // 1. Metadata extraction
    println!("Extracting metadata for {}", video_path);
    let (width, height, has_audio) = match get_video_metadata(video_path).await {
        Ok(m) => m,
        Err(e) => {
            eprintln!("Metadata extraction failed for {}: {}", video_path, e);
            return Err(e);
        }
    };
    let aspect_ratio = width / height;
    println!("Metadata: width={} height={} has_audio={} aspect_ratio={}", width, height, has_audio, aspect_ratio);
    
    // 2. Prep Output
    let output_dir = format!("{}_hls", video_path);
    if !Path::new(&output_dir).exists() {
        fs::create_dir_all(&output_dir).await?;
    }

    // 3. Transcode + Thumbnail Concurrently
    let transcoding_fut = transcode_tiered(video_path, &output_dir, format, &config, status_map.clone(), task_id.clone(), has_audio, &tier);
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
    
    trans_res?;
    thumb_res?;

    // 4. Upload to Storage
    match StorageManager::new().await {
        Ok(storage) => {
            let s3_prefix = format!("videos/{}", task_id);
            if let Some(ref map) = status_map {
                map.insert(task_id.clone(), TaskStatus {
                    progress: 98,
                    status: "uploading".to_string(),
                    message: "Uploading to cloud storage...".to_string(),
                });
            }
            storage.upload_hls_dir(&output_dir, &s3_prefix).await?;
            
            // Upload thumbnail too
            if !skip_thumbnail {
                let thumb_path = format!("{}.jpg", video_path);
                let thumb_key = format!("thumbnails/{}.jpg", task_id);
                storage.upload_file(Path::new(&thumb_path), &thumb_key).await?;
            }
        },
        Err(e) => {
            eprintln!("Storage Manager initialization failed: {}. Skipping upload.", e);
            return Err(anyhow!("Storage initialization failed: {}", e));
        }
    }
    Ok(())
}

async fn get_video_metadata(video_path: &str) -> Result<(i32, i32, bool)> {
    let output = Command::new("ffprobe")
        .args(&[
            "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=s=x:p=0",
            video_path,
        ])
        .output().await?;
    
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
            "-v", "error", "-select_streams", "a",
            "-show_entries", "stream=index",
            "-of", "csv=p=0",
            video_path,
        ])
        .output().await?;
    
    let has_audio = !String::from_utf8(audio_output.stdout)?.trim().is_empty();

    Ok((width, height, has_audio))
}

async fn transcode_tiered(
    input: &str, 
    output_dir: &str, 
    format: &str, 
    config: &TranscodingConfig,
    status_map: Option<StatusMap>,
    task_id: String,
    has_audio: bool,
    tier: &UserTier
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
        let sm = if has_audio { "v:0,a:0,name:original".to_string() } else { "v:0,name:original".to_string() };
        (format!("[0:v]scale=w=-2:h={}[vout]", source_height), sm, 1)
    } else if config.max_height <= 720 {
        // Free tier — two quality levels, capped at 720p
        let sm = if has_audio {
            "v:0,a:0,name:720p v:1,a:1,name:480p".to_string()   // ← unique a:0 / a:1
        } else {
            "v:0,name:720p v:1,name:480p".to_string()
        };
        (
            "[0:v]split=2[v1][v2]; [v1]scale=w=-2:h=720[v1out]; [v2]scale=w=-2:h=480[v2out]".to_string(),
            sm, 2
        )
    } else {
        // Pro tier — three quality levels up to 1080p
        let sm = if has_audio {
            "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p".to_string()  // ← unique a:0/a:1/a:2
        } else {
            "v:0,name:1080p v:1,name:720p v:2,name:480p".to_string()
        };
        (
            "[0:v]split=3[v1][v2][v3]; [v1]scale=w=-2:h=1080[v1out]; [v2]scale=w=-2:h=720[v2out]; [v3]scale=w=-2:h=480[v3out]".to_string(),
            sm, 3
        )
    };

    // ── 2. Build args as Vec<String> so we can push dynamic per-stream options ─
    let mut args: Vec<String> = vec![
        "-i".into(), input.into(),
        // NOTE: Do NOT add global -c:a here — it conflicts with per-stream -c:a:N below
        "-preset".into(), config.preset.clone(),
        "-crf".into(), config.crf.clone(),
        "-f".into(), "hls".into(),
        "-hls_time".into(), "6".into(),
        "-hls_playlist_type".into(), "vod".into(),
        "-master_pl_name".into(), "master.m3u8".into(),
        "-filter_complex".into(), filter.clone(),
    ];

    // ── 3. Video stream mappings ─────────────────────────────────────────────
    if filter.contains("split=3") {
        args.extend(["-map","[v1out]","-c:v:0","libx264","-b:v:0","5000k",
                      "-map","[v2out]","-c:v:1","libx264","-b:v:1","2800k",
                      "-map","[v3out]","-c:v:2","libx264","-b:v:2","1200k"]
            .iter().map(|s| s.to_string()));
    } else if filter.contains("split=2") {
        args.extend(["-map","[v1out]","-c:v:0","libx264","-b:v:0","2800k",
                     "-map","[v2out]","-c:v:1","libx264","-b:v:1","1200k"]
            .iter().map(|s| s.to_string()));
    } else {
        args.extend(["-map","[vout]","-c:v:0","libx264","-b:v:0","2800k"]
            .iter().map(|s| s.to_string()));
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
    let output_pattern   = format!("{}/%v.m3u8",    output_dir);

    args.extend([
        "-hls_segment_filename".to_string(), segment_filename,
        "-var_stream_map".to_string(),        stream_map,
        output_pattern,
    ]);

    if let Some(ref map) = status_map {
        map.insert(task_id, TaskStatus {
            progress: 15,
            status: "processing".to_string(),
            message: format!("Compressing and optimizing video (Tier: {:?})", tier),
        });
    }

    let output = Command::new("ffmpeg").args(&args).output().await?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        eprintln!("FFmpeg Error: {}", err);
        return Err(anyhow!("FFmpeg failed: {}", err));
    }
    Ok(())

}

async fn get_video_height(input: &str) -> Result<i32> {
    let output = Command::new("ffprobe")
        .args(&["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=height", "-of", "csv=p=0", input])
        .output().await?;
    let s = String::from_utf8(output.stdout)?;
    Ok(s.trim().parse()?)
}

async fn generate_thumbnail(video_path: &str) -> Result<()> {
    let thumb_path = format!("{}.jpg", video_path);
    let status = Command::new("ffmpeg")
        .args(&[
            "-ss", "00:00:01", 
            "-i", video_path, 
            "-frames:v", "1", 
            "-update", "1", 
            "-q:v", "2", 
            "-y", &thumb_path
        ])
        .status().await?;
    if !status.success() {
        return Err(anyhow!("Thumbnail generation failed"));
    }
    Ok(())
}
