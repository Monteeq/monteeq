"""
Send one of every email type to smasduqacc@gmail.com.
Run from: backend/  →  source .venv/bin/activate && python send_test_emails.py
"""
import os, sys
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.services.email_service import (
    send_verification_email,
    send_password_reset_email,
    send_pro_upgrade_email,
    send_challenge_announcement_batch,
    send_challenge_exit_email,
    send_welcome_email,
    send_day3_nudge_email,
    send_first_video_email,
    send_first_follower_email,
    send_first_like_email,
    send_weekly_digest_email,
    send_monthly_stats_email,
    send_reengagement_email,
    send_challenge_ending_soon_email,
    send_challenge_result_email,
    send_security_email,
    send_subscription_email,
    send_first_comment_email,
    send_mention_email,
    send_growth_drip_email,
    send_celebration_email,
    send_social_batch_email,
)

TO   = "smasduqacc@gmail.com"
BCC  = [TO]

SAMPLE_VIDEOS = [
    {"title": "Dubai Cinematic Edit",     "creator": "@darkframe",  "url": "https://monteeq.com/v/1"},
    {"title": "BMPCC Color Grade Reel",   "creator": "@colorist_k", "url": "https://monteeq.com/v/2"},
    {"title": "Speed Ramp Showreel 2026", "creator": "@rampgod",    "url": "https://monteeq.com/v/3"},
    {"title": "Minimal Title Motion",     "creator": "@typemotion", "url": "https://monteeq.com/v/4"},
    {"title": "Anamorphic Street Edit",   "creator": "@lensflare",  "url": "https://monteeq.com/v/5"},
]

SAMPLE_STATS = {"views": 4821, "likes": 312, "followers": 47, "uploads": 6}

tests = [
    ("Verification",            lambda: send_verification_email(TO, "847291")),
    ("Password Reset",          lambda: send_password_reset_email(TO, "tok_abc123xyz")),
    ("Pro Upgrade",             lambda: send_pro_upgrade_email(TO, "smasduq")),
    ("Challenge Announcement",  lambda: send_challenge_announcement_batch(BCC, "The Creator Showdown", "$500", "June 30, 2026")),
    ("Challenge Exit",          lambda: send_challenge_exit_email(TO, "smasduq", "The Creator Showdown")),
    ("Welcome",                 lambda: send_welcome_email(TO, "smasduq")),
    ("Day-3 Nudge",             lambda: send_day3_nudge_email(TO, "smasduq")),
    ("First Video",             lambda: send_first_video_email(TO, "smasduq", "Dubai Cinematic Edit", "https://monteeq.com/v/1")),
    ("First Follower",          lambda: send_first_follower_email(TO, "smasduq", "darkframe")),
    ("First Like",              lambda: send_first_like_email(TO, "smasduq", "Dubai Cinematic Edit", "darkframe", "https://monteeq.com/v/1")),
    ("Weekly Digest",           lambda: send_weekly_digest_email(BCC, SAMPLE_VIDEOS)),
    ("Monthly Stats",           lambda: send_monthly_stats_email(TO, "smasduq", "May", SAMPLE_STATS)),
    ("Re-engagement",           lambda: send_reengagement_email(TO, "smasduq")),
    ("Challenge Ending Soon",   lambda: send_challenge_ending_soon_email(BCC, "The Creator Showdown", "$500", "June 30, 2026")),
    ("Challenge Result",        lambda: send_challenge_result_email(BCC, "The Creator Showdown", "darkframe", "https://monteeq.com/v/1", "$500")),
    # New Sprint 2 & 3 tests
    ("Security (New Device)",   lambda: send_security_email(TO, "new_device_login", "smasduq", device_info="MacBook Pro", ip_address="192.168.1.1", location="London, UK")),
    ("Security (PW Changed)",   lambda: send_security_email(TO, "password_changed", "smasduq", timestamp="2026-06-04")),
    ("Subscription (Started)",  lambda: send_subscription_email(TO, "trial_started", "smasduq")),
    ("Subscription (Ending)",   lambda: send_subscription_email(TO, "trial_ending", "smasduq", expiry_date="June 10, 2026")),
    ("First Comment",           lambda: send_first_comment_email(TO, "smasduq", "Dubai Cinematic Edit", "darkframe", "Great pacing, keep it up!", "https://monteeq.com/v/1")),
    ("Mention",                 lambda: send_mention_email(TO, "smasduq", "darkframe", "Check out @smasduq's street edit, clean ramps!", "https://monteeq.com/v/1")),
    ("Growth Drip (Week 1)",    lambda: send_growth_drip_email(TO, "smasduq", 1)),
    ("Celebration (Anniversary)", lambda: send_celebration_email(TO, "smasduq", "welcome_anniversary")),
    ("Social Batch Recap",      lambda: send_social_batch_email(TO, "smasduq", "- 3 new followers\n- 12 new likes on your edits\n- 2 new comments on your videos")),
]

print(f"\n{'─'*52}")
print(f"  Sending {len(tests)} emails to {TO}")
print(f"{'─'*52}\n")

results = {}
for name, fn in tests:
    try:
        ok = fn()
        results[name] = ok
        print(f"  [{'OK  ' if ok else 'FAIL'}]  {name}")
    except Exception as e:
        results[name] = False
        print(f"  [ERR ]  {name}  →  {type(e).__name__}: {e}")

passed = sum(results.values())
total  = len(results)
print(f"\n{'─'*52}")
print(f"  {passed}/{total} sent successfully.")
print(f"{'─'*52}\n")
sys.exit(0 if passed == total else 1)
