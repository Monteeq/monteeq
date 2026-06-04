# uses {username}, {milestone_value} (where applicable)

VARIANTS = {
    "welcome_anniversary": [
        {
            "subject": "Happy anniversary on Monteeq, {username}!",
            "heading": "One year of creating.",
            "body": "It's been exactly one year since you joined Monteeq. Thank you for being a vital part of our creative community. Here's to another year of amazing edits!",
            "action_text": "View Your Portfolio"
        }
    ],
    "first_upload_anniversary": [
        {
            "subject": "One year since your first upload, {username}",
            "heading": "An editing milestone.",
            "body": "One year ago today, you uploaded your first video to Monteeq. Look at how far your skills and edits have come since then!",
            "action_text": "See Your First Video"
        }
    ],
    "milestone_100_followers": [
        {
            "subject": "You reached 100 followers on Monteeq!",
            "heading": "100 followers milestone.",
            "body": "Congratulations, {username} — 100 people are now following your work and waiting for your next upload. Keep the momentum going!",
            "action_text": "Check Your Stats"
        }
    ],
    "milestone_1000_followers": [
        {
            "subject": "Milestone: 1,000 followers, {username}!",
            "heading": "A major milestone reached.",
            "body": "Incredible work! 1,000 creators are now following your journey on Monteeq. This is a massive milestone for your personal brand.",
            "action_text": "Go to Dashboard"
        }
    ],
    "milestone_10000_views": [
        {
            "subject": "Your edits have reached 10,000 views!",
            "heading": "10,000 views milestone.",
            "body": "Outstanding! Your videos have been viewed a combined total of 10,000 times. People are watching and appreciating your work.",
            "action_text": "See Analytics"
        }
    ],
    "creator_of_the_month": [
        {
            "subject": "You are a Creator of the Month on Monteeq!",
            "heading": "Top creator status.",
            "body": "Congratulations {username}! Due to high engagement and outstanding uploads, you've been featured as one of our Creators of the Month. A badge has been added to your profile.",
            "action_text": "View Your Profile"
        }
    ]
}

def pick_celebration(template_type: str) -> dict:
    import random
    variants_list = VARIANTS.get(template_type)
    if not variants_list:
        variants_list = list(VARIANTS.values())[0]
    return random.choice(variants_list)
