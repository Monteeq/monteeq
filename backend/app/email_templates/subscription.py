# uses {username}, {expiry_date}, {plan_name}, {amount} (where applicable)

VARIANTS = {
    "trial_started": [
        {
            "subject": "Your Monteeq Pro trial has started",
            "heading": "Welcome to Monteeq Pro Trial",
            "body": "Hey {username} — your 14-day free trial of Monteeq Pro is now active. Explore unlimited 4K uploads, advanced portfolio themes, and priority rendering.",
            "action_text": "Start Creating",
        },
        {
            "subject": "Pro features unlocked: Trial active",
            "heading": "Let's make something big.",
            "body": "Your Pro trial is officially live. Get ready to experience Monteeq with zero ads and priority creator benefits for the next 14 days.",
            "action_text": "Explore Pro features",
        }
    ],
    "trial_ending": [
        {
            "subject": "Your Monteeq Pro trial is ending in 3 days",
            "heading": "3 days left on Pro Trial",
            "body": "Hey {username} — just a heads-up that your free trial of Monteeq Pro expires on {expiry_date}. Upgrade today to keep your exclusive portfolio features and analytics.",
            "action_text": "Upgrade to Pro",
        },
        {
            "subject": "Don't lose your Pro status",
            "heading": "Your trial ends soon.",
            "body": "Your trial access ends on {expiry_date}. To keep uploading in 4K and using priority render queues without interruption, finalize your subscription details below.",
            "action_text": "Keep Pro features",
        }
    ],
    "trial_expired": [
        {
            "subject": "Your Monteeq Pro trial has expired",
            "heading": "Trial expired",
            "body": "Hey {username} — your free trial of Monteeq Pro has expired. Your account has reverted to the free plan. Your existing uploads are safe, but you've lost access to advanced portfolio customization.",
            "action_text": "Upgrade to Pro",
        },
        {
            "subject": "Go Pro again, {username}",
            "heading": "Unlock Pro once more.",
            "body": "Your trial is over, but you can jump back into Pro at any time to resume 4K uploads and view advanced creator metrics.",
            "action_text": "See Pro Plans",
        }
    ],
    "payment_failed": [
        {
            "subject": "Action Required: Payment failed for Monteeq Pro",
            "heading": "Payment failed",
            "body": "We were unable to process your subscription payment of {amount} for Monteeq Pro. To avoid account downgrade, please update your billing details.",
            "action_text": "Update Billing",
        },
        {
            "subject": "Billing Alert: Update your payment details",
            "heading": "Unable to charge account",
            "body": "Our charge of {amount} for your subscription failed. Please click below to verify or update your credit card details.",
            "action_text": "Verify payment",
        }
    ],
    "subscription_renewed": [
        {
            "subject": "Your Monteeq Pro subscription has renewed",
            "heading": "Subscription renewed",
            "body": "Hey {username} — thank you for staying with us. Your Monteeq Pro subscription has successfully renewed for another billing cycle. Receipt amount: {amount}.",
            "action_text": "View Receipt",
        },
        {
            "subject": "Receipt for your Monteeq Pro renewal",
            "heading": "Successful renewal",
            "body": "Your account has been billed {amount} for your Monteeq Pro renewal. Thank you for supporting the platform.",
            "action_text": "Manage Billing",
        }
    ],
    "subscription_cancelled": [
        {
            "subject": "Your Monteeq Pro subscription is cancelled",
            "heading": "We're sorry to see you go.",
            "body": "Hey {username} — you've cancelled your Monteeq Pro subscription. You will retain Pro access until the end of your current billing period on {expiry_date}. We'd love to hear your feedback.",
            "action_text": "Share Feedback",
        },
        {
            "subject": "Subscription cancellation confirmed",
            "heading": "Cancellation confirmed",
            "body": "Your Pro benefits will expire on {expiry_date}. If you change your mind, you can renew your subscription at any time with one click.",
            "action_text": "Resume subscription",
        }
    ]
}

def pick_subscription(template_type: str) -> dict:
    import random
    variants_list = VARIANTS.get(template_type)
    if not variants_list:
        variants_list = list(VARIANTS.values())[0]
    return random.choice(variants_list)
