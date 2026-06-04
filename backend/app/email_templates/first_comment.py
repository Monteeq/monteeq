# uses {username}, {commenter_name}, {video_title}, {comment_content}
VARIANTS = [
    {
        "subject": "New comment on your video from {commenter_name}",
        "heading": "Your video got its first comment.",
        "body": "{commenter_name} left a comment on your video '{video_title}':\n\n\"{comment_content}\"",
        "action_text": "Reply to Comment"
    },
    {
        "subject": "{commenter_name} commented: \"{comment_content}\"",
        "heading": "First feedback is in.",
        "body": "Hey {username} — {commenter_name} commented on '{video_title}':\n\n\"{comment_content}\"",
        "action_text": "View Comment"
    },
    {
        "subject": "Feedback on your video '{video_title}'",
        "heading": "First comment.",
        "body": "{commenter_name} just shared their thoughts on '{video_title}':\n\n\"{comment_content}\"",
        "action_text": "Join the conversation"
    }
]
