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
        smtp_cls = smtplib.SMTP_SSL
        use_starttls = False
    else:
        smtp_cls = smtplib.SMTP
        use_starttls = True

    with smtp_cls(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as server:
        if use_starttls:
            server.starttls()
        server.login(config.SMTP_USER, config.SMTP_PASS)
        
        if is_bcc:
            server.sendmail(config.SMTP_FROM, all_recipients, msg_string)
        else:
            server.sendmail(config.SMTP_FROM, to_email, msg_string)

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
                msg["To"] = "undisclosed-recipients:;"
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
            logger.error(
                f"SMTP Failed for {to_email} after retries using "
                f"{config.SMTP_HOST}:{config.SMTP_PORT} "
                f"as {config.SMTP_USER} — {type(e).__name__}: {e}"
            )
            logger.warning(f"Falling back to console log for email to {to_email}")

    # --- 2. Final Fallback (Console) ---
    logger.warning(f"NO EMAIL SERVICE ACTIVE. Email '{subject}' to {to_email}")
    print(f"\n[DEV LOG] EMAIL TO {to_email}\nSUBJECT: {subject}\nCONTENT: {plain_text}\n")
    return False

def _base_email_template(content_html: str) -> str:
    """Wraps inner content in the Monteeq Gilded Obsidian base email shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Monteeq</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body,table,td{{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}}
    table,td{{mso-table-lspace:0pt;mso-table-rspace:0pt;}}
    body{{margin:0!important;padding:0!important;background-color:#080808;}}
    @media screen and (max-width:600px){{
      .card{{width:100%!important;}}
      .mobile-pad{{padding:32px 24px!important;}}
      .btn{{width:100%!important;text-align:center!important;}}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#080808;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background-color:#080808;padding:48px 16px;">
    <tr><td align="center">

      <table role="presentation" class="card" width="560" cellpadding="0"
             cellspacing="0"
             style="background:#0f0f0f;border:1px solid #1e1e1e;
                    border-radius:12px;
                    box-shadow:0 0 24px rgba(255,59,48,0.08);
                    overflow:hidden;">

        <!-- Red accent top bar -->
        <tr>
          <td height="3"
              style="background:linear-gradient(90deg,#ff3b30,#ff5e55);
                     font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- Logo -->
        <tr>
          <td align="center" style="padding:40px 48px 32px;">
            <span style="font-family:-apple-system,BlinkMacSystemFont,
                          'Segoe UI',Arial,sans-serif;font-size:28px;
                          font-weight:900;letter-spacing:6px;color:#ff3b30;">
              MONTEEQ
            </span>
          </td>
        </tr>

        <!-- Top divider -->
        <tr>
          <td style="padding:0 48px;">
            <table role="presentation" width="100%" cellpadding="0"
                   cellspacing="0">
              <tr><td height="1"
                      style="background:#1e1e1e;font-size:0;line-height:0;">
                &nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- CONTENT SLOT -->
        <tr>
          <td class="mobile-pad" style="padding:40px 48px;">
            {content_html}
          </td>
        </tr>

        <!-- Bottom divider -->
        <tr>
          <td style="padding:0 48px;">
            <table role="presentation" width="100%" cellpadding="0"
                   cellspacing="0">
              <tr><td height="1"
                      style="background:#1e1e1e;font-size:0;line-height:0;">
                &nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding:28px 48px 36px;">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,
                       'Segoe UI',Arial,sans-serif;font-size:12px;
                       color:#48484a;line-height:1.6;">
              You're receiving this because you have a Monteeq account.<br>
              &copy; 2026 Monteeq. All rights reserved.
            </p>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>
</body>
</html>"""


def _primary_button(text: str, url: str) -> str:
    """Helper to generate an Outlook-compatible primary button."""
    return f"""<!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
    href="{url}" style="height:48px;v-text-anchor:middle;width:200px;"
    arcsize="17%" fillcolor="#ff3b30" stroke="f">
    <w:anchorlock/>
    <center style="color:#ffffff;font-family:sans-serif;
                   font-size:14px;font-weight:800;letter-spacing:1px;">
      {text}
    </center>
  </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-->
  <a href="{url}"
     style="background:linear-gradient(135deg,#ff3b30 0%,#ff5e55 100%);
            color:#ffffff;padding:14px 36px;border-radius:8px;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',
            Arial,sans-serif;font-size:14px;font-weight:800;
            letter-spacing:1px;text-transform:uppercase;
            text-decoration:none;display:inline-block;">
    {text}
  </a>
  <!--<![endif]-->"""


def send_verification_email(to_email: str, code: str) -> bool:
    plain_text = f"Welcome to Monteeq!\n\nYour verification code is: {code}\nExpires in 10 mins."
    content_html = f"""
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;margin:0 0 16px;line-height:1.3;">Confirm your email</p>
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:400;color:#8e8e93;margin:0 0 16px;line-height:1.7;">Use the code below to finish setting up your Monteeq account.
  It expires in 10 minutes.</p>

  <!-- Code block -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:32px 0;">
    <tr>
      <td align="center"
          style="background:#1a1a1a;border:1px solid #2e2e2e;
                 border-radius:8px;padding:28px;">
        <span style="font-family:'Courier New',Courier,monospace;
                     font-size:44px;font-weight:900;letter-spacing:16px;
                     color:#ffffff;">{code}</span>
      </td>
    </tr>
  </table>

  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#48484a;margin:0;line-height:1.6;">Didn't create a Monteeq account? You can safely ignore this email.</p>
"""
    html = _base_email_template(content_html)
    return _send_email_logic(to_email, f"{code} is your Monteeq code", plain_text, html)

def send_password_reset_email(to_email: str, token: str) -> bool:
    reset_link = f"{config.FRONTEND_URL}/reset-password?token={token}&email={to_email}"
    plain_text = f"Reset your Monteeq password:\n\nClick here: {reset_link}\n\nThis link expires in 1 hour."
    content_html = f"""
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;margin:0 0 16px;line-height:1.3;text-align:center;">Reset your password</p>
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:400;color:#8e8e93;margin:0 0 16px;line-height:1.7;text-align:center;">
    We got a request to reset your Monteeq password.<br>
    Hit the button below — this link is valid for 1 hour.
  </p>

  <!-- Button centered -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:36px 0;">
    <tr><td align="center">
      {_primary_button("Reset Password", reset_link)}
    </td></tr>
  </table>

  <!-- Security note box -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:#1a1a1a;border-left:3px solid #ff3b30;
                 border-radius:0 6px 6px 0;padding:16px 20px;">
        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#8e8e93;line-height:1.6;">
          Didn't request this? Your account is fine — just ignore this email.
          The link expires automatically.
        </p>
      </td>
    </tr>
  </table>
"""
    html = _base_email_template(content_html)
    return _send_email_logic(to_email, "Reset your Monteeq password", plain_text, html)

def send_challenge_announcement_batch(bcc_emails: list, title: str, prize: str, end_date: str) -> bool:
    content_html = f"""
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;
             color:#ff3b30;text-transform:uppercase;
             text-align:center;margin:0 0 16px;">New Challenge</p>
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;margin:0 0 16px;line-height:1.3;text-align:center;">{title}</p>

  <!-- Prize pool highlight box -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:28px 0;">
    <tr>
      <td align="center"
          style="background:#1a1a1a;border:1px solid #2e2e2e;
                 border-top:2px solid #ff3b30;border-radius:8px;
                 padding:28px;">
        <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;
                   letter-spacing:3px;color:#48484a;text-transform:uppercase;">
          Prize Pool
        </p>
        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:40px;font-weight:900;color:#ffffff;">
          {prize}
        </p>
      </td>
    </tr>
  </table>

  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:400;color:#8e8e93;margin:0 0 16px;line-height:1.7;text-align:center;">
    Submit your best edit before {end_date}. One shot, real prize money.
  </p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin-top:32px;">
    <tr><td align="center">
      {_primary_button("Enter Challenge", "https://monteeq.com/challenges")}
    </td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain_text = f"New Challenge: {title}! Win {prize}. Join at https://monteeq.com/challenges"
    return _send_email_logic(None, f"New Challenge: {title} — Win {prize}", plain_text, html, bcc_list=bcc_emails)

def send_pro_upgrade_email(to_email: str, username: str) -> bool:
    content_html = f"""
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;margin:0 0 16px;line-height:1.3;text-align:center;">You're now Pro, {username}.</p>
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:400;color:#8e8e93;margin:0 0 16px;line-height:1.7;text-align:center;">
    Your account has been upgraded to Monteeq Pro. Here's what you now have access to:
  </p>

  <!-- Perks list (table rows — Outlook safe) -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:28px 0;background:#1a1a1a;border:1px solid #2e2e2e;
                border-top:2px solid #ff3b30;border-radius:8px;overflow:hidden;">
    <tr><td style="padding:16px 20px;border-bottom:1px solid #2e2e2e;">
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#ff3b30;font-weight:800;">&#10003;</span>&nbsp;
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#fff;font-size:14px;font-weight:600;">4K Video Uploads</span>
    </td></tr>
    <tr><td style="padding:16px 20px;border-bottom:1px solid #2e2e2e;">
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#ff3b30;font-weight:800;">&#10003;</span>&nbsp;
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#fff;font-size:14px;font-weight:600;">Priority Processing Queue</span>
    </td></tr>
    <tr><td style="padding:16px 20px;border-bottom:1px solid #2e2e2e;">
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#ff3b30;font-weight:800;">&#10003;</span>&nbsp;
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#fff;font-size:14px;font-weight:600;">Advanced Creator Analytics</span>
    </td></tr>
    <tr><td style="padding:16px 20px;">
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#ff3b30;font-weight:800;">&#10003;</span>&nbsp;
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#fff;font-size:14px;font-weight:600;">Ad-Free Experience</span>
    </td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      {_primary_button("Start Creating", "https://monteeq.com")}
    </td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain_text = f"Congratulations {username}! You are now a Monteeq Pro user."
    return _send_email_logic(to_email, f"You're now on Monteeq Pro", plain_text, html)

def send_challenge_exit_email(to_email: str, username: str, challenge_title: str) -> bool:
    content_html = f"""
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;margin:0 0 16px;line-height:1.3;">Challenge update, {username}</p>
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:400;color:#8e8e93;margin:0 0 16px;line-height:1.7;">
    Your entry was removed from the following challenge because the video was deleted:
  </p>

  <!-- Challenge name box -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:24px 0;">
    <tr>
      <td style="background:#1a1a1a;border-left:3px solid #48484a;
                 border-radius:0 6px 6px 0;padding:16px 20px;">
        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;color:#fff;">
          {challenge_title}
        </p>
      </td>
    </tr>
  </table>

  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:400;color:#8e8e93;margin:0 0 16px;line-height:1.7;">
    You can still compete — upload a new video to re-enter the challenge at any time.
  </p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin-top:32px;">
    <tr><td align="center">
      <a href="https://monteeq.com/challenges"
         style="color:#ff3b30;padding:12px 28px;border-radius:8px;
                border:1px solid #ff3b30;background:transparent;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                font-size:14px;font-weight:800;letter-spacing:1px;
                text-transform:uppercase;text-decoration:none;
                display:inline-block;">
        View Challenges
      </a>
    </td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain_text = f"Hi {username}, you've been removed from '{challenge_title}' because your entry video was deleted."
    return _send_email_logic(to_email, f"Update on Challenge: {challenge_title}", plain_text, html)

def send_email(to_email: str, subject: str, title: str, message: str, action_text: str = None, action_url: str = None) -> bool:
    action_html = ""
    if action_text and action_url:
        full_url = f"{config.BASE_URL}{action_url}" if action_url.startswith("/") else action_url
        action_html = f'''
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">
      {_primary_button(action_text, full_url)}
    </td></tr>
  </table>'''

    content_html = f"""
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;margin:0 0 16px;line-height:1.3;text-align:center;">{title}</p>
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:400;color:#8e8e93;margin:0 0 16px;line-height:1.7;text-align:center;">{message}</p>
  {action_html}
"""
    html_content = _base_email_template(content_html)

    return _send_email_logic(to_email, subject, message, html_content)

_missing = [v for v, k in {
    "SMTP_HOST": config.SMTP_HOST,
    "SMTP_USER": config.SMTP_USER,
    "SMTP_PASS": config.SMTP_PASS,
    "SMTP_FROM": config.SMTP_FROM,
}.items() if not k]

if _missing:
    logger.warning(
        f"EMAIL SERVICE MISCONFIGURED — missing env vars: {{', '.join(_missing)}}. "
        "All emails will fall back to console logging until this is fixed."
    )
