# uses {username}, {mentioner_name}, {context_text}
VARIANTS = [
    {
        "subject": "{mentioner_name} mentioned you on Monteeq",
        "heading": "You were mentioned.",
        "body": "{mentioner_name} mentioned you in their post/comment:\n\n\"{context_text}\"",
        "action_text": "View Mention"
    },
    {
        "subject": "New mention from {mentioner_name}",
        "heading": "Someone mentioned you.",
        "body": "Hey {username} — you were tagged/mentioned by {mentioner_name}:\n\n\"{context_text}\"",
        "action_text": "Join the conversation"
    }
]
