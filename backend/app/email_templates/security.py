# uses {username}, {device_info}, {ip_address}, {location} (where applicable)

VARIANTS = {
    "new_device_login": [
        {
            "subject": "New login detected on Monteeq",
            "heading": "New device login",
            "body": "We noticed a new login to your Monteeq account ({username}) from a new device/browser:\n\nDevice: {device_info}\nIP Address: {ip_address}\nLocation: {location}",
            "action_text": "Secure Account",
        },
        {
            "subject": "Was this you? New login from {device_info}",
            "heading": "New device detected",
            "body": "A new login was recorded for your account. Details:\n\nDevice: {device_info}\nIP: {ip_address}\nLocation: {location}\n\nIf this was you, you can safely ignore this mail.",
            "action_text": "Verify Activity",
        }
    ],
    "password_changed": [
        {
            "subject": "Your Monteeq password has been updated",
            "heading": "Password updated",
            "body": "Hey {username} — the password for your Monteeq account was recently changed. If you initiated this change, no action is needed.",
            "action_text": "Secure Account",
        },
        {
            "subject": "Security Alert: Password changed",
            "heading": "Your password was changed",
            "body": "The password for your account was changed on {timestamp}. If you did not make this change, please recover your account immediately.",
            "action_text": "Reset Password",
        }
    ],
    "email_changed": [
        {
            "subject": "Monteeq email address changed",
            "heading": "Email update request",
            "body": "The primary email address for your Monteeq account has been changed to {new_email}. We have sent a confirmation link to that address.",
            "action_text": "Revert Change",
        },
        {
            "subject": "Security notice: Email address updated",
            "heading": "Account email changed",
            "body": "Your account email address was changed to {new_email}. If you did not authorize this, please contact support immediately.",
            "action_text": "Contact Support",
        }
    ],
    "account_recovery": [
        {
            "subject": "Monteeq account recovery initiated",
            "heading": "Account recovery request",
            "body": "An account recovery process was started for your username ({username}). Use the link below to verify your identity.",
            "action_text": "Recover Account",
        },
        {
            "subject": "Recover your Monteeq account",
            "heading": "Identity verification",
            "body": "Please click the button below to complete your account recovery request. This link will expire shortly.",
            "action_text": "Complete Recovery",
        }
    ],
    "suspicious_activity": [
        {
            "subject": "Security Alert: Suspicious activity detected",
            "heading": "Suspicious login attempt",
            "body": "We blocked a suspicious login attempt on your account from {ip_address} ({location}). Please verify your credentials.",
            "action_text": "Review Activity",
        },
        {
            "subject": "Action Required: Secure your account",
            "heading": "Security alert",
            "body": "Our automated systems detected unusual activity on your Monteeq account. For your security, we suggest changing your password.",
            "action_text": "Change Password",
        }
    ],
    "account_locked": [
        {
            "subject": "Your Monteeq account has been locked",
            "heading": "Account locked",
            "body": "For security reasons, your account was temporarily locked due to too many failed login attempts. You can unlock it using the button below.",
            "action_text": "Unlock Account",
        }
    ]
}

def pick_security(template_type: str) -> dict:
    import random
    variants_list = VARIANTS.get(template_type)
    if not variants_list:
        # fallback to first key
        variants_list = list(VARIANTS.values())[0]
    return random.choice(variants_list)
