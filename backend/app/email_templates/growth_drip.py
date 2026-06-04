# uses {username}
VARIANTS = {
    1: [
        {
            "subject": "5 things that make a great Monteeq profile",
            "heading": "Let's polish your portfolio.",
            "body": "Hey {username} — a great portfolio makes all the difference when other creators or hiring brands view your profile. Make sure you pin your best edit, fill out your bio, and add your skills.",
            "action_text": "Edit Profile"
        }
    ],
    2: [
        {
            "subject": "What top-viewed edits have in common",
            "heading": "Editing tips from the pros.",
            "body": "Analyzing top-performing videos on Monteeq shows that the first 3 seconds are crucial. Keep pacing high, choose engaging audio, and use smooth transitions to keep retention high.",
            "action_text": "Browse Top Edits"
        }
    ],
    3: [
        {
            "subject": "How creators grow faster by engaging first",
            "heading": "Connect with the community.",
            "body": "Monteeq is not just a showcase — it's a network. Engage with other video editors, leave feedback on their uploads, and collaborate on challenges to grow your audience faster.",
            "action_text": "Discover Creators"
        }
    ],
    4: [
        {
            "subject": "Posting consistency: what the data shows",
            "heading": "Consistency is key.",
            "body": "Creators who upload at least once a week see 3x higher engagement than irregular posters. Keep your timeline active by uploading works-in-progress, speed-ramps, or challenge entries.",
            "action_text": "Upload an Edit"
        }
    ],
    5: [
        {
            "subject": "Your profile is your pitch — here's how to sharpen it",
            "heading": "Build your personal brand.",
            "body": "When sharing your Monteeq link on social media or job applications, treat it as your interactive resume. Keep it clean, link your socials, and showcase your specific niche.",
            "action_text": "Update Profile"
        }
    ]
}

def pick_growth_drip(week: int) -> dict:
    import random
    variants_list = VARIANTS.get(week, VARIANTS[1])
    return random.choice(variants_list)
