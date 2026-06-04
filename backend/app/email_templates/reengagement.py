# uses {username}
# Keyed by days: 3, 7, 14, 30, 60, 90

VARIANTS = {
    3: [
        {
            "subject": "Good time to post something new",
            "heading": "It's been a few days, {username}.",
            "body_1": "You haven't posted in 3 days. The community has been active — new challenges, new creators, new edits going up every day.",
            "body_2": "Come back and show them what you've been working on.",
        },
        {
            "subject": "Ready to upload, {username}?",
            "heading": "Keep the momentum going.",
            "body_1": "It's been 3 days since you last logged in. The best way to grow is consistency.",
            "body_2": "Share an edit or check out what others are posting today.",
        }
    ],
    7: [
        {
            "subject": "A week away from Monteeq",
            "heading": "It's been a week, {username}.",
            "body_1": "A lot can happen in 7 days. New challenges are live and trending video editors are sharing their latest work.",
            "body_2": "Check out your feed and get inspired to post your next project.",
        },
        {
            "subject": "We miss your edits",
            "heading": "One week offline.",
            "body_1": "Hey {username} — it's been 7 days since you were active. Don't let your profile go quiet.",
            "body_2": "Come back to see the latest challenges and entries.",
        }
    ],
    14: [
        {
            "subject": "It's been two weeks, {username}",
            "heading": "Two weeks offline.",
            "body_1": "We haven't seen you on Monteeq for 14 days. The community is still growing and new projects are waiting for feedback.",
            "body_2": "Upload your latest edit or jump into a challenge today.",
        },
        {
            "subject": "What are you working on?",
            "heading": "Hey {username}, still editing?",
            "body_1": "It's been 14 days since your last activity. We'd love to see what you've been cooking up in your timeline.",
            "body_2": "Come share your latest work-in-progress on Monteeq.",
        }
    ],
    30: [
        {
            "subject": "Good time to post something new",
            "heading": "It's been a while, {username}.",
            "body_1": "You haven't posted in 30 days. The community has been active — new challenges, new creators, new edits going up every day.",
            "body_2": "Come back and show them what you've been working on.",
        },
        {
            "subject": "The community is still here, {username}",
            "heading": "The feed keeps moving.",
            "body_1": "It's been 30 days since your last post, {username}. Creators are uploading, challenges are live, and there's a spot in the feed with your name on it.",
            "body_2": "Drop something. Even a short edit counts.",
        },
        {
            "subject": "30 days — come back with something",
            "heading": "Still got it, {username}?",
            "body_1": "A lot has happened on Monteeq while you were away. New challenges, new faces, and a community that's still creating.",
            "body_2": "Pick up where you left off. Upload something today.",
        },
        {
            "subject": "We miss your edits, {username}",
            "heading": "Your last post was 30 days ago.",
            "body_1": "Hey {username} — things have been quiet on your end. The community would love to see what you've been making.",
            "body_2": "Come back. Upload something. Even one video gets you back in the mix.",
        }
    ],
    60: [
        {
            "subject": "It's been 2 months, {username}",
            "heading": "Two months away.",
            "body_1": "We haven't seen any new uploads or activity from you in 60 days. There are new features, challenges, and opportunities on the platform.",
            "body_2": "Check out the feed to see what has changed while you were gone.",
        },
        {
            "subject": "We saved your spot in the feed",
            "heading": "Welcome back anytime.",
            "body_1": "It's been 60 days, {username}. The editing community is still sharing premium work. We'd love to have you back.",
            "body_2": "Upload an edit to refresh your portfolio.",
        }
    ],
    90: [
        {
            "subject": "Is your Monteeq profile still active?",
            "heading": "Three months away.",
            "body_1": "It's been 90 days since your last activity. Your account and portfolio are safe, but a lot of new opportunities have been posted recently.",
            "body_2": "Log in to keep your profile active and visible to hiring creators.",
        },
        {
            "subject": "Keep your portfolio active",
            "heading": "Still there, {username}?",
            "body_1": "Your account has been inactive for 90 days. Keep your portfolio fresh so other creators and editors can find your work.",
            "body_2": "Log back in to Monteeq and upload your latest reel.",
        }
    ]
}

def pick_reengagement(days: int) -> dict:
    import random
    variants_list = VARIANTS.get(days, VARIANTS[30])
    return random.choice(variants_list)
