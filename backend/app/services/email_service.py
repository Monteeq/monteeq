"""
Email service for Monteeq platform.
Uses Zoho SMTP for all communications.
"""
import logging
import os
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core import config
from app.core.config import SMTP_FROM, SMTP_FROM_NAME

logger = logging.getLogger(__name__)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _execute_smtp_send(to_email, all_recipients, msg_string, is_bcc):
    """Executes the SMTP send with automatic retries on failure."""
    if config.SMTP_PORT == 465:
        server = smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT)
    else:
        server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT)
        server.starttls()

    server.login(config.SMTP_USER, config.SMTP_PASS)
    
    if is_bcc:
        server.sendmail(config.SMTP_FROM, all_recipients, msg_string)
    else:
        server.sendmail(config.SMTP_FROM, to_email, msg_string)
        
    server.quit()

def _send_email_logic(to_email: str, subject: str, plain_text: str, html_content: str, bcc_list: list = None) -> bool:
    """
    Core logic to send emails via Zoho SMTP.
    """
    # --- 1. Try Zoho SMTP ---
    if config.SMTP_HOST and config.SMTP_USER and config.SMTP_PASS:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{config.SMTP_FROM_NAME} <{config.SMTP_FROM}>"
            
            if bcc_list:
                # For mass emails via SMTP, we send one by one or use BCC header.
                # To protect privacy, we'll send to sender and BCC others.
                msg["To"] = config.SMTP_FROM
                all_recipients = [to_email] + bcc_list if to_email else bcc_list
            else:
                msg["To"] = to_email
                all_recipients = [to_email]

            msg.attach(MIMEText(plain_text, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            _execute_smtp_send(to_email, all_recipients, msg.as_string(), bool(bcc_list))
                
            logger.info(f"SMTP: Email '{subject}' sent to {to_email}")
            return True
        except Exception as e:
            logger.error(f"SMTP Failed for {to_email} after retries: {e}")

    # --- 2. Final Fallback (Console) ---
    logger.warning(f"NO EMAIL SERVICE ACTIVE. Email '{subject}' to {to_email}")
    print(f"\n[DEV LOG] EMAIL TO {to_email}\nSUBJECT: {subject}\nCONTENT: {plain_text}\n")
    return False

def send_verification_email(to_email: str, code: str) -> bool:
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
    return _send_email_logic(to_email, f"{code} is your Monteeq code", plain_text, html)

def send_password_reset_email(to_email: str, token: str) -> bool:
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
    return _send_email_logic(to_email, "Reset your Monteeq password", plain_text, html)

def send_challenge_announcement_batch(bcc_emails: list, title: str, prize: str, end_date: str) -> bool:
    html = f"""
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#050505;font-family:sans-serif;">
  <table width="100%" style="background:#050505;padding:60px 0;">
    <tr>
      <td align="center">
        <table width="560" style="background:#0a0a0a;border-radius:12px;border:1px solid #1a1a20;border-top:1px solid #eb0000;overflow:hidden;">
          <tr><td style="padding:48px;text-align:center;"><h1 style="margin:0;font-size:32px;font-weight:900;letter-spacing:4px;color:#eb0000;">NEW CHALLENGE</h1></td></tr>
          <tr><td style="padding:0 60px 44px;text-align:center;">
            <p style="margin:0 0 12px;font-size:26px;font-weight:800;color:#ffffff;text-transform:uppercase;">{title}</p>
            <div style="background:#050505;border:1px solid #222;border-left:4px solid #eb0000;border-radius:8px;padding:30px;margin:24px 0;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:3px;color:#555;text-transform:uppercase;">PRIZE POOL</p>
              <p style="margin:0;font-size:42px;font-weight:900;color:#fff;">{prize}</p>
            </div>
            <a href="https://monteeq.com/challenges" style="display:inline-block;padding:16px 36px;background:#eb0000;color:#fff;text-decoration:none;font-weight:800;border-radius:4px;text-transform:uppercase;letter-spacing:2px;">JOIN NOW</a>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    """
    plain_text = f"New Challenge: {title}! Win {prize}. Join at https://monteeq.com/challenges"
    return _send_email_logic(None, f"🔥 New Challenge: {title} | Win {prize}!", plain_text, html, bcc_list=bcc_emails)

def send_pro_upgrade_email(to_email: str, username: str) -> bool:
    html = f"""
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#050505;font-family:sans-serif;">
  <table width="100%" style="background:#050505;padding:60px 0;">
    <tr><td align="center">
        <table width="560" style="background:#0a0a0a;border-radius:12px;border:1px solid #1a1a20;border-top:1px solid #eb0000;">
          <tr><td style="padding:48px;text-align:center;"><h1 style="margin:0;font-size:32px;font-weight:900;letter-spacing:4px;color:#eb0000;">MONTEEQ PRO</h1></td></tr>
          <tr><td style="padding:0 60px 44px;text-align:center;">
            <p style="font-size:26px;font-weight:800;color:#ffffff;">Congratulations, {username}!</p>
            <p style="color:#8e8e93;">Your account has been officially upgraded to <span style="color:#eb0000;font-weight:700;">Monteeq Pro</span>.</p>
            <div style="background:#050505;border:1px solid #222;border-left:4px solid #eb0000;border-radius:8px;padding:30px;margin:24px 0;">
              <p style="color:#fff;">✓ 4K Video Uploads<br/>✓ Priority Queue<br/>✓ Advanced Analytics</p>
            </div>
            <a href="https://monteeq.com" style="display:inline-block;padding:16px 36px;background:#eb0000;color:#fff;text-decoration:none;font-weight:800;border-radius:4px;">START CREATING</a>
          </td></tr>
        </table>
    </td></tr>
  </table>
</body>
</html>
    """
    plain_text = f"Congratulations {username}! You are now a Monteeq Pro user."
    return _send_email_logic(to_email, "🎉 Welcome to Monteeq Pro!", plain_text, html)

def send_challenge_exit_email(to_email: str, username: str, challenge_title: str) -> bool:
    html = f"""
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#050505;font-family:sans-serif;">
  <table width="100%" style="background:#050505;padding:60px 0;">
    <tr><td align="center">
        <table width="560" style="background:#0a0a0a;border-radius:12px;border:1px solid #1a1a20;border-top:1px solid #555;">
          <tr><td style="padding:48px;text-align:center;"><h1 style="color:#888;letter-spacing:4px;">CHALLENGE UPDATE</h1></td></tr>
          <tr><td style="padding:0 60px 44px;text-align:center;">
            <p style="color:#fff;font-size:22px;font-weight:800;">Hi {username},</p>
            <p style="color:#8e8e93;">You've been removed from the challenge:</p>
            <div style="background:#050505;border:1px solid #222;border-left:4px solid #555;padding:20px;margin:24px 0;">
              <p style="color:#fff;font-weight:700;">{challenge_title}</p>
            </div>
            <p style="color:#555;font-size:14px;">This is because your entry video was deleted. You can enter again with a fresh video!</p>
            <a href="https://monteeq.com/challenges" style="display:inline-block;padding:12px 24px;border:1px solid #eb0000;color:#eb0000;text-decoration:none;font-weight:700;margin-top:30px;">VIEW CHALLENGES</a>
          </td></tr>
        </table>
    </td></tr>
  </table>
</body>
</html>
    """
    plain_text = f"Hi {username}, you've been removed from '{challenge_title}' because your entry video was deleted."
    return _send_email_logic(to_email, f"Update on Challenge: {challenge_title}", plain_text, html)
