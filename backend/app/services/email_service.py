"""
Email service for Monteeq platform.
Uses Brevo (Sendinblue) HTTP API bypassing SMTP port blocks.
"""
import logging
import os
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core import config
from app.core.config import SMTP_FROM, SMTP_FROM_NAME

logger = logging.getLogger(__name__)
BREVO_API_KEY = config.BREVO_API_KEY

def send_verification_email(to_email: str, code: str) -> bool:
    """
    Send a verification code email.
    Tries SMTP first (for Hostinger/Custom), then falls back to Brevo API if configured.
    """
    plain_text = f"Welcome to Monteeq!\n\nYour verification code is: {code}\nExpires in 10 mins."
    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <body style="margin:0;padding:0;background:#000;font-family:sans-serif;color:#fff;">
      <div style="padding:40px;text-align:center;">
        <h1 style="color:#FF3B30;">MONTEEQ</h1>
        <p style="font-size:18px;">Your verification code is:</p>
        <div style="font-size:48px;font-weight:900;letter-spacing:10px;margin:20px 0;">{code}</div>
        <p style="color:#888;">Expires in 10 minutes.</p>
      </div>
    </body>
    </html>
    """

    # --- Try SMTP (Hostinger / Custom) ---
    if config.SMTP_HOST and config.SMTP_USER and config.SMTP_PASS:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"{code} is your Monteeq code"
            msg["From"] = f"{config.SMTP_FROM_NAME} <{config.SMTP_FROM}>"
            msg["To"] = to_email

            msg.attach(MIMEText(plain_text, "plain"))
            msg.attach(MIMEText(html, "html"))

            # Use Port 465 for SSL or 587 for TLS
            if config.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT)
            else:
                server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT)
                server.starttls()

            server.login(config.SMTP_USER, config.SMTP_PASS)
            server.sendmail(config.SMTP_FROM, to_email, msg.as_string())
            server.quit()
            logger.info(f"SMTP: Email sent to {to_email}")
            return True
        except Exception as e:
            logger.error(f"SMTP Failed for {to_email}: {e}")
            print(f"[DEBUG] SMTP Error: {e}")
            # Fall through to Brevo if SMTP fails

    # --- Fallback to Brevo API ---
    if BREVO_API_KEY:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "api-key": BREVO_API_KEY,
            "accept": "application/json",
            "content-type": "application/json",
        }
        payload = {
            "sender": {"name": config.SMTP_FROM_NAME, "email": config.SMTP_FROM},
            "to": [{"email": to_email}],
            "subject": f"{code} is your Monteeq code",
            "htmlContent": html,
            "textContent": plain_text
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code in (200, 201, 202):
                logger.info(f"Brevo: Email sent to {to_email}")
                return True
            else:
                logger.error(f"Brevo API Refused Email to {to_email}: {resp.status_code} - {resp.text}")
                print(f"[DEBUG] Brevo API Error: {resp.status_code} - {resp.text}")
        except Exception as e:
            logger.error(f"Brevo HTTP Request Failed: {e}")
            print(f"[DEBUG] Brevo Request Error: {e}")

    # --- Absolute Fallback (Print to Console) ---
    logger.warning(f"NO EMAIL SERVICE ACTIVE. Code for {to_email}: {code}")
    print(f"\n[DEV LOG] CODE FOR {to_email}: {code}\n")
    return False

def send_password_reset_email(to_email: str, token: str) -> bool:
    """
    Send a secure password reset link.
    """
    reset_link = f"{config.FRONTEND_URL}/reset-password?token={token}&email={to_email}"
    
    plain_text = f"Reset your Monteeq password:\n\nClick here: {reset_link}\n\nThis link expires in 1 hour."
    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <body style="margin:0;padding:0;background:#000;font-family:sans-serif;color:#fff;text-align:center;">
      <div style="padding:60px 20px;">
        <h1 style="color:#eb0000;font-size:32px;letter-spacing:4px;">MONTEEQ</h1>
        <h2 style="margin-top:40px;font-size:24px;">Reset your password</h2>
        <p style="color:#888;margin:20px 0 40px;">Click the button below to set a new password for your account.</p>
        <a href="{reset_link}" style="background:#eb0000;color:#fff;padding:16px 32px;text-decoration:none;border-radius:8px;font-weight:800;display:inline-block;">RESET PASSWORD</a>
        <p style="color:#444;font-size:12px;margin-top:60px;">This link will expire in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    </body>
    </html>
    """

    if config.SMTP_HOST and config.SMTP_USER and config.SMTP_PASS:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Reset your Monteeq password"
            msg["From"] = f"{config.SMTP_FROM_NAME} <{config.SMTP_FROM}>"
            msg["To"] = to_email
            msg.attach(MIMEText(plain_text, "plain"))
            msg.attach(MIMEText(html, "html"))

            if config.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT)
            else:
                server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT)
                server.starttls()

            server.login(config.SMTP_USER, config.SMTP_PASS)
            server.sendmail(config.SMTP_FROM, to_email, msg.as_string())
            server.quit()
            return True
        except Exception:
            pass

    if BREVO_API_KEY:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {"api-key": BREVO_API_KEY, "accept": "application/json", "content-type": "application/json"}
        payload = {
            "sender": {"name": config.SMTP_FROM_NAME, "email": config.SMTP_FROM},
            "to": [{"email": to_email}],
            "subject": "Reset your Monteeq password",
            "htmlContent": html,
            "textContent": plain_text
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            return resp.status_code in (200, 201, 202)
        except Exception:
            pass
            
    print(f"\n[DEV LOG] RESET LINK FOR {to_email}: {reset_link}\n")
    return False

def send_challenge_announcement_batch(bcc_emails: list, title: str, prize: str, end_date: str) -> bool:
    """
    Sends an announcement email for a new challenge using the Brevo HTTP API.
    Utilizes bcc to mass broadcast efficiently and securely.
    """
    if not BREVO_API_KEY:
        logger.warning(f"BREVO_API_KEY missing - skipping mass email for '{title}' to {len(bcc_emails)} users.")
        return False
        
    if not bcc_emails:
        return True
        
    html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#050505;font-family:'Inter','Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:60px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#0a0a0a;
                      border-radius:12px;
                      border:1px solid #1a1a20;
                      border-top:1px solid #eb0000;
                      box-shadow: 0 20px 50px rgba(0,0,0,0.9), 0 0 20px rgba(235,0,0,0.1);
                      overflow:hidden;">
                      
          <tr>
            <td style="padding:48px 48px 32px; text-align:center;">
               <h1 style="margin:0;font-family:'Space Mono','Courier New',monospace;font-size:32px;font-weight:900;letter-spacing:4px;color:#eb0000;">
                 NEW CHALLENGE
               </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:0 60px 44px;">
              <p style="margin:0 0 12px;font-family:'Outfit',sans-serif;font-size:26px;font-weight:800;color:#ffffff;text-align:center;text-transform:uppercase;">
                {title}
              </p>
              
              <div style="background:#050505;
                          border:1px solid #222;
                          border-left:4px solid #eb0000;
                          border-radius:8px;
                          padding:30px 20px;
                          text-align:center;
                          margin:24px 0;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:3px;color:#555;text-transform:uppercase;">
                  PRIZE POOL
                </p>
                <p style="margin:0;font-size:42px;font-weight:900;color:#fff;">
                  {prize}
                </p>
              </div>

              <div style="text-align:center; margin-top:32px;">
                 <a href="https://monteeq.com/challenges" style="display:inline-block; padding:16px 36px; background:#eb0000; color:#fff; text-decoration:none; font-weight:800; border-radius:4px; text-transform:uppercase; letter-spacing:2px;">JOIN NOW</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    """
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": BREVO_API_KEY,
        "accept": "application/json",
        "content-type": "application/json",
    }

    sender_email = SMTP_FROM or "hello@monteeq.com"
    sender_name = SMTP_FROM_NAME or "Monteeq"

    bcc_list = [{"email": e} for e in bcc_emails]

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": sender_email}], # The TO must exist, typically we use our own generic address
        "bcc": bcc_list,
        "subject": f"🔥 New Challenge: {title} | Win {prize}!",
        "htmlContent": html,
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code in (200, 201, 202):
            logger.info(f"Challenge broadcast email sent successfully to {len(bcc_emails)} users.")
            return True
        else:
            logger.error(f"Brevo API batch error: {response.text}")
            return False
    except Exception as exc:
        logger.error(f"Failed to mass broadcast challenge emails: {exc}")
        return False

def send_pro_upgrade_email(to_email: str, username: str) -> bool:
    """
    Sends a congratulatory email when a user is promoted to Pro.
    """
    if not BREVO_API_KEY:
        logger.warning(f"BREVO_API_KEY missing - skipping PRO email to {to_email}.")
        return False
        
    html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#050505;font-family:'Inter','Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:60px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#0a0a0a;
                      border-radius:12px;
                      border:1px solid #1a1a20;
                      border-top:1px solid #eb0000;
                      box-shadow: 0 20px 50px rgba(0,0,0,0.9), 0 0 20px rgba(235,0,0,0.1);
                      overflow:hidden;">
                      
          <tr>
            <td style="padding:48px 48px 32px; text-align:center;">
               <h1 style="margin:0;font-family:'Space Mono','Courier New',monospace;font-size:32px;font-weight:900;letter-spacing:4px;color:#eb0000;">
                 MONTEEQ PRO
               </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:0 60px 44px;">
              <p style="margin:0 0 12px;font-family:'Outfit',sans-serif;font-size:26px;font-weight:800;color:#ffffff;text-align:center;">
                Congratulations, {username}!
              </p>
              
              <p style="margin:0 0 36px;font-size:16px;color:#8e8e93;line-height:1.6;text-align:center;">
                Your account has been officially upgraded to <span style="color:#eb0000;font-weight:700;">Monteeq Pro</span> status.
              </p>
              
              <div style="background:#050505;
                          border:1px solid #222;
                          border-left:4px solid #eb0000;
                          border-radius:8px;
                          padding:30px 20px;
                          text-align:center;
                          margin:24px 0;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:3px;color:#555;text-transform:uppercase;">
                  NEW BENEFITS UNLOCKED
                </p>
                <p style="margin:0;font-size:16px;font-weight:600;color:#fff;">
                  ✓ 4K Video Uploads<br/>
                  ✓ Priority Transcoding Queue<br/>
                  ✓ Advanced Analytics
                </p>
              </div>

              <div style="text-align:center; margin-top:32px;">
                 <a href="https://monteeq.com" style="display:inline-block; padding:16px 36px; background:#eb0000; color:#fff; text-decoration:none; font-weight:800; border-radius:4px; text-transform:uppercase; letter-spacing:2px;">START CREATING</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    """
    
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": BREVO_API_KEY,
        "accept": "application/json",
        "content-type": "application/json",
    }

    sender_email = SMTP_FROM or "hello@monteeq.com"
    sender_name = SMTP_FROM_NAME or "Monteeq"

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email}],
        "subject": "🎉 Welcome to Monteeq Pro!",
        "htmlContent": html,
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code in (200, 201, 202):
            logger.info(f"Pro upgrade email sent successfully to {to_email}.")
            return True
        else:
            logger.error(f"Brevo API error: {response.text}")
            return False
    except Exception as exc:
        logger.error(f"Failed to send pro upgrade email: {exc}")
        return False

def send_new_video_admin_alert_batch(bcc_emails: list, video_title: str, uploader_username: str, video_id: int) -> bool:
    """
    Sends an alert email to all admins when a new video is uploaded.
    """
    if not BREVO_API_KEY:
        logger.warning(f"BREVO_API_KEY missing - skipping admin alert for video {video_id}.")
        return False
        
    if not bcc_emails:
        return True
        
    html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#050505;font-family:'Inter','Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:60px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#0a0a0a;
                      border-radius:12px;
                      border:1px solid #1a1a20;
                      border-top:1px solid #eb0000;
                      box-shadow: 0 20px 50px rgba(0,0,0,0.9), 0 0 20px rgba(235,0,0,0.1);
                      overflow:hidden;">
                      
          <tr>
            <td style="padding:48px 48px 32px; text-align:center;">
               <h1 style="margin:0;font-family:'Space Mono','Courier New',monospace;font-size:26px;font-weight:900;letter-spacing:2px;color:#eb0000;">
                 ADMIN ALERT: NEW UPLOAD
               </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:0 60px 44px;">
              <p style="margin:0 0 12px;font-family:'Outfit',sans-serif;font-size:22px;font-weight:800;color:#ffffff;text-align:center;">
                {video_title}
              </p>
              
              <div style="background:#050505;
                          border:1px solid #222;
                          border-left:4px solid #eb0000;
                          border-radius:8px;
                          padding:20px;
                          text-align:center;
                          margin:24px 0;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;color:#555;text-transform:uppercase;">
                  UPLOADER
                </p>
                <p style="margin:0;font-size:18px;font-weight:600;color:#fff;">
                  @{uploader_username}
                </p>
              </div>

              <div style="text-align:center; margin-top:32px;">
                 <a href="https://monteeq.com/admin/approvals" style="display:inline-block; padding:16px 36px; background:#eb0000; color:#fff; text-decoration:none; font-weight:800; border-radius:4px; text-transform:uppercase; letter-spacing:2px;">REVIEW IN QUEUE</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    """
    
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": BREVO_API_KEY,
        "accept": "application/json",
        "content-type": "application/json",
    }

    sender_email = SMTP_FROM or "hello@monteeq.com"
    sender_name = SMTP_FROM_NAME or "Monteeq Admin"

    bcc_list = [{"email": e} for e in bcc_emails]

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": sender_email}],
        "bcc": bcc_list,
        "subject": f"⚠️ New Upload: {video_title} by @{uploader_username}",
        "htmlContent": html,
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code in (200, 201, 202):
            logger.info(f"Admin alert email sent successfully to {len(bcc_emails)} admins.")
            return True
        else:
            logger.error(f"Brevo API error: {response.text}")
            return False
    except Exception as exc:
        logger.error(f"Failed to send admin alert email: {exc}")
        return False
