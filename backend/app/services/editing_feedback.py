import logging
import statistics
from typing import List

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pure metric computation (no I/O, fully testable)
# ---------------------------------------------------------------------------

BEAT_SYNC_TOLERANCE_MS = 150  # ±150 ms window for a cut to be considered on-beat


def compute_edit_metrics(
    scene_cuts: List[float],
    beat_timestamps: List[float],
) -> dict:
    """Analyse scene-cut timing relative to beats.

    Parameters
    ----------
    scene_cuts : list[float]
        Timestamps (seconds) where scene cuts occur.
    beat_timestamps : list[float]
        Timestamps (seconds) of detected beats.

    Returns
    -------
    dict with keys:
        cut_count, cut_durations (list[float]), avg_cut_duration,
        min_cut_duration, max_cut_duration, std_cut_duration,
        beat_sync_score (float 0-100), beat_offsets_ms (list[float]),
        total_duration_seconds, total_beats
    """
    if not scene_cuts or len(scene_cuts) < 2:
        return {
            "cut_count": 0,
            "cut_durations": [],
            "avg_cut_duration": 0.0,
            "min_cut_duration": 0.0,
            "max_cut_duration": 0.0,
            "std_cut_duration": 0.0,
            "beat_sync_score": 0.0,
            "beat_offsets_ms": [],
            "total_duration_seconds": 0.0,
            "total_beats": len(beat_timestamps),
        }

    # --- Cut durations ---
    cut_durations = []
    for i in range(1, len(scene_cuts)):
        dur = scene_cuts[i] - scene_cuts[i - 1]
        if dur > 0:
            cut_durations.append(dur)

    if not cut_durations:
        return {
            "cut_count": 0,
            "cut_durations": [],
            "avg_cut_duration": 0.0,
            "min_cut_duration": 0.0,
            "max_cut_duration": 0.0,
            "std_cut_duration": 0.0,
            "beat_sync_score": 0.0,
            "beat_offsets_ms": [],
            "total_duration_seconds": scene_cuts[-1] - scene_cuts[0] if len(scene_cuts) > 1 else 0.0,
            "total_beats": len(beat_timestamps),
        }

    # For each cut (transition point at scene_cuts[i]), find the nearest beat
    beat_offsets_ms = []
    on_beat_count = 0
    total_beats = len(beat_timestamps)

    # The cut "moment" is the end of each segment: scene_cuts[i]
    for i in range(1, len(scene_cuts)):
        cut_ts = scene_cuts[i]
        if not beat_timestamps:
            beat_offsets_ms.append(0.0)
            continue

        nearest_beat = min(beat_timestamps, key=lambda b: abs(b - cut_ts))
        offset_ms = (cut_ts - nearest_beat) * 1000.0
        beat_offsets_ms.append(offset_ms)

        if abs(offset_ms) <= BEAT_SYNC_TOLERANCE_MS:
            on_beat_count += 1

    total_cuts = len(scene_cuts) - 1  # number of cut transitions
    beat_sync_score = (on_beat_count / total_cuts * 100.0) if total_cuts > 0 else 0.0

    return {
        "cut_count": total_cuts,
        "cut_durations": cut_durations,
        "avg_cut_duration": statistics.mean(cut_durations),
        "min_cut_duration": min(cut_durations),
        "max_cut_duration": max(cut_durations),
        "std_cut_duration": statistics.stdev(cut_durations) if len(cut_durations) > 1 else 0.0,
        "beat_sync_score": round(beat_sync_score, 1),
        "beat_offsets_ms": [round(o, 2) for o in beat_offsets_ms],
        "total_duration_seconds": round(scene_cuts[-1] - scene_cuts[0], 2),
        "total_beats": total_beats,
    }


# ---------------------------------------------------------------------------
# AI feedback generation (calls Gemini 2.5 Flash via google-genai SDK)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an experienced AMV (anime music video) and video-edit critique assistant. You are given structured numeric metrics about an edit — cut durations, beat sync offsets, and overall pacing stats — plus the video title.

Your job: provide specific, actionable feedback grounded in the actual numbers. Do NOT give generic advice like \"try cutting to the beat\". Instead:

1. Write a 2-3 sentence overall summary of the edit quality.
2. Then provide 3-5 specific bullet points. Where relevant, reference actual timestamp ranges (e.g. \"the 0:45-1:10 section has cuts averaging 2.1s while the rest of the edit averages 0.8s\") and the beat sync percentage.

Focus on:
- Pacing consistency — are cut durations uniform or highly variable? Is the average too fast/slow for the feel of the edit?
- Beat sync quality — how many cuts land within ±150ms of a beat? Are there sections that drift off-beat?
- Whether specific sections feel rushed or dragging, based on the distribution of cut durations.

Be direct and constructive. Use natural language. Do not use markdown formatting."""


def generate_feedback(metrics: dict, video_title: str) -> str:
    """Call Gemini 2.5 Flash to generate editing feedback.

    Parameters
    ----------
    metrics : dict
        The dict returned by ``compute_edit_metrics()``.
    video_title : str
        Title of the video, used as context.

    Returns
    -------
    str — the raw feedback text from the model.
    """
    api_key = _get_gemini_api_key()
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — using fallback feedback")
        return _compute_offline_fallback(metrics, video_title)

    from google import genai

    client = genai.Client(api_key=api_key)

    metrics_text = _build_metrics_text(metrics)

    user_content = (
        f"Video title: {video_title}\n\n"
        f"Edit metrics:\n{metrics_text}\n\n"
        "Please provide specific, actionable editing feedback based on these numbers."
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_content,
            config=genai.types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                max_output_tokens=1024,
            ),
        )
        if not response.text:
            logger.warning("Gemini returned empty response — using fallback feedback")
            return _compute_offline_fallback(metrics, video_title)
        return response.text
    except Exception as exc:
        logger.warning("Gemini API call failed — using fallback feedback: %s", exc)
        return _compute_offline_fallback(metrics, video_title)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_gemini_api_key() -> str | None:
    """Read GEMINI_API_KEY from config or environment."""
    try:
        from app.core import config

        return getattr(config, "GEMINI_API_KEY", None) or None
    except (ImportError, AttributeError):
        import os
        return os.getenv("GEMINI_API_KEY") or None


def _build_metrics_text(metrics: dict) -> str:
    cuts = metrics.get("cut_durations", [])
    lines = [
        f"- Total cuts: {metrics.get('cut_count', 0)}",
        f"- Average cut duration: {metrics.get('avg_cut_duration', 0):.2f}s",
        f"- Shortest cut: {metrics.get('min_cut_duration', 0):.2f}s",
        f"- Longest cut: {metrics.get('max_cut_duration', 0):.2f}s",
        f"- Cut duration std dev: {metrics.get('std_cut_duration', 0):.2f}s",
        f"- Beat sync score: {metrics.get('beat_sync_score', 0):.1f}% of cuts within ±150ms of a beat",
        f"- Total edit duration: {metrics.get('total_duration_seconds', 0):.1f}s",
        f"- Total beats in track: {metrics.get('total_beats', 0)}",
    ]
    if cuts and len(cuts) >= 3:
        # Show first few cut durations to give a sense of pacing pattern
        sample = [round(d, 2) for d in cuts[:10]]
        lines.append(f"- Cut duration sequence (first 10): {sample}{'…' if len(cuts) > 10 else ''}")

    return "\n".join(lines)


def _compute_offline_fallback(metrics: dict, video_title: str) -> str:
    """Generate a purely data-driven feedback string when the AI API is unavailable.

    This mirrors the spirit of the AI prompt: summary + bullet points grounded in numbers.
    """
    avg = metrics.get("avg_cut_duration", 0)
    std = metrics.get("std_cut_duration", 0)
    sync = metrics.get("beat_sync_score", 0)
    count = metrics.get("cut_count", 0)
    total_dur = metrics.get("total_duration_seconds", 0)
    cuts = metrics.get("cut_durations", [])

    summary = (
        f"Your edit for \"{video_title}\" contains {count} cuts over {total_dur:.0f}s "
        f"({total_dur / 60:.1f}m). "
    )
    if avg > 0:
        summary += f"Cuts average {avg:.1f}s each. "
    if std > 1.0:
        summary += "Pacing varies considerably between sections. "
    elif count > 0:
        summary += "Pacing is fairly consistent. "

    bullets = []

    # Pacing assessment
    if avg > 4.0:
        bullets.append(f"Average cut length of {avg:.1f}s suggests a slow, atmospheric edit. If the track is energetic, consider tighter cuts (under 3s).")
    elif avg > 2.0:
        bullets.append(f"Average cut length of {avg:.1f}s is moderate. If the section around 0:{int(total_dur*0.3)}-0:{int(total_dur*0.5)} has longer cuts, check whether it drags relative to the energy of that part of the song.")
    elif avg > 0.5:
        bullets.append(f"Cuts averaging {avg:.1f}s give the edit a brisk pace. Watch for sections where cuts cluster below 1s — they can feel jarring if the music doesn't support that speed.")
    else:
        bullets.append("Very fast cutting rate (under 1s average). Ensure each cut has visual purpose rather than just hitting every drum hit.")

    # Variability
    if std > 0 and count > 0:
        rel_std = std / avg if avg > 0 else 0
        if rel_std > 1.0:
            bullets.append(f"High duration variability (std dev {std:.1f}s, {rel_std:.0%} of mean). The edit jumps between very short and long cuts — check whether this is intentional for the song structure or feels disjointed.")
        elif rel_std < 0.3 and count > 5:
            bullets.append(f"Very uniform cut durations (std dev {std:.1f}s). Consider varying cut length more to match musical phrasing rather than a metronomic rhythm.")

    # Beat sync
    if sync >= 80:
        bullets.append(f"Excellent beat sync ({sync:.0f}% of cuts on-beat). The edit is well-timed to the music.")
    elif sync >= 50:
        bullets.append(f"Moderate beat sync ({sync:.0f}%). Some cuts land off-beat — review the sections around the largest offsets (over 200ms) and nudge those cut points.")
    else:
        bullets.append(f"Low beat sync ({sync:.0f}%). Many cuts do not align with a nearby beat. Consider re-timing larger sections to land on downbeats for a more satisfying rhythm.")

    return summary + "\n\n" + "\n".join(f"- {b}" for b in bullets)
