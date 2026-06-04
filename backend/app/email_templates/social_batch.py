# uses {username}, {summary_text}
VARIANTS = [
    {
        "subject": "Your daily activity recap on Monteeq",
        "heading": "While you were away...",
        "body": "Here is a quick summary of the interactions on your profile and videos in the last 24 hours:\n\n{summary_text}",
        "action_text": "View Activity Feed"
    },
    {
        "subject": "New activity on your Monteeq profile",
        "heading": "You've got notifications.",
        "body": "Hey {username} — here's what the community has been up to on your posts and videos:\n\n{summary_text}",
        "action_text": "View Notifications"
    }
]

def pick_social_batch() -> dict:
    import random
    return random.choice(VARIANTS)
