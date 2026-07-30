"""Tests for compute_edit_metrics (pure, no I/O)."""
import math

import pytest

from app.services.editing_feedback import compute_edit_metrics


def test_empty_cuts():
    """No scene cuts at all (or only 1) → zero metrics."""
    m = compute_edit_metrics([], [1.0, 2.0, 3.0])
    assert m["cut_count"] == 0
    assert m["cut_durations"] == []
    assert m["beat_sync_score"] == 0.0

    m2 = compute_edit_metrics([0.5], [1.0, 2.0])
    assert m2["cut_count"] == 0


def test_perfect_beat_sync():
    """Every cut lands exactly on a beat → 100% sync."""
    cuts = [0.0, 1.0, 2.0, 3.0, 4.0]
    beats = [0.0, 1.0, 2.0, 3.0, 4.0]
    m = compute_edit_metrics(cuts, beats)
    assert m["cut_count"] == 4
    assert m["beat_sync_score"] == 100.0
    assert all(abs(o) <= 150 for o in m["beat_offsets_ms"])


def test_no_beat_sync():
    """Cuts far from any beat → 0% sync."""
    cuts = [0.0, 5.0, 10.0, 15.0]
    beats = [1.0, 2.0, 3.0]  # all far (>150 ms) from 5, 10, 15
    m = compute_edit_metrics(cuts, beats)
    assert m["cut_count"] == 3
    assert m["beat_sync_score"] == 0.0


def test_partial_beat_sync():
    """Half of cuts within tolerance → 50% sync."""
    cuts = [0.0, 1.0, 5.0, 6.0]  # cuts at 1.0 and 6.0 are on beats; 0.0 ignored (first), 5.0 is far
    beats = [1.0, 2.0, 6.0, 7.0]
    m = compute_edit_metrics(cuts, beats)
    # cut transitions: 0→1 (1.0 is on beat), 1→5 (5.0 is ~3s from nearest beat 6.0 → off), 5→6 (6.0 is on beat)
    assert m["cut_count"] == 3
    assert m["beat_sync_score"] == 66.7  # 2/3


def test_cut_durations():
    """Basic duration stats."""
    cuts = [0.0, 2.0, 5.0, 9.0]  # durations: 2, 3, 4
    m = compute_edit_metrics(cuts, [])
    assert m["cut_durations"] == [2.0, 3.0, 4.0]
    assert m["avg_cut_duration"] == 3.0
    assert m["min_cut_duration"] == 2.0
    assert m["max_cut_duration"] == 4.0
    assert m["total_duration_seconds"] == 9.0


def test_std_dev_single_value():
    """A single cut → std dev is 0 (no variance)."""
    cuts = [0.0, 3.0]
    m = compute_edit_metrics(cuts, [])
    assert m["cut_count"] == 1
    assert m["cut_durations"] == [3.0]
    assert m["std_cut_duration"] == 0.0


def test_std_dev_multiple():
    """Multiple cuts produce non-zero std dev (uses sample std dev, n-1 divisor)."""
    cuts = [0.0, 1.0, 3.0, 7.0]  # durations: 1, 2, 4
    m = compute_edit_metrics(cuts, [])
    # statistics.stdev uses sample std dev (n-1 divisor)
    mean = (1 + 2 + 4) / 3  # 7/3 ≈ 2.333
    variance = ((1 - mean)**2 + (2 - mean)**2 + (4 - mean)**2) / (3 - 1)
    expected_std = math.sqrt(variance)  # ≈ 1.528
    assert m["std_cut_duration"] == pytest.approx(expected_std, rel=1e-3)


def test_beat_offsets_ms():
    """Verify offset calculation in ms."""
    cuts = [0.0, 1.5, 3.0]
    beats = [1.0, 2.0, 3.0]
    m = compute_edit_metrics(cuts, beats)
    # Cut at 1.5: nearest beat is 1.0 or 2.0 (offset = +500ms or -500ms) → 500ms
    # Cut at 3.0: nearest beat is 3.0 (offset = 0ms)
    offsets = m["beat_offsets_ms"]
    assert len(offsets) == 2
    # first offset: |1.5 - 1.0| = 0.5s vs |1.5 - 2.0| = 0.5s → 0.5s = 500ms
    assert abs(offsets[0]) == 500.0
    assert offsets[1] == 0.0


def test_avg_and_total_duration():
    """Check total duration and average."""
    cuts = [10.0, 15.0, 25.0, 40.0]
    m = compute_edit_metrics(cuts, [])
    assert m["total_duration_seconds"] == 30.0  # 40 - 10
    assert m["avg_cut_duration"] == 10.0  # (5+10+15)/3
    assert m["cut_durations"] == [5.0, 10.0, 15.0]


def test_empty_beats():
    """No beats at all should not crash."""
    cuts = [0.0, 2.0, 4.0]
    m = compute_edit_metrics(cuts, [])
    assert m["cut_count"] == 2
    assert m["beat_sync_score"] == 0.0
    assert m["beat_offsets_ms"] == [0.0, 0.0]
    assert m["total_beats"] == 0
