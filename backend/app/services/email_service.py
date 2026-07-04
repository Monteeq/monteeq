"""
Email service for Monteeq platform.
Uses Zoho SMTP for all communications.
"""
import logging
import os
import random
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core import config
from app.core.config import SMTP_FROM, SMTP_FROM_NAME
from app.email_templates import pick
from app.email_templates import verification     as _t_verify
from app.email_templates import password_reset   as _t_reset
from app.email_templates import pro_upgrade      as _t_pro
from app.email_templates import challenge_announce as _t_announce
from app.email_templates import challenge_exit   as _t_exit
from app.email_templates import welcome          as _t_welcome
from app.email_templates import day3_nudge       as _t_day3
from app.email_templates import first_video      as _t_fvideo
from app.email_templates import first_follower   as _t_ffollower
from app.email_templates import first_like       as _t_flike
from app.email_templates import digest           as _t_digest
from app.email_templates import reengagement     as _t_reeng
from app.email_templates import challenge_ending as _t_ending
from app.email_templates import challenge_result as _t_result
from app.email_templates import security         as _t_sec
from app.email_templates import subscription     as _t_sub
from app.email_templates import first_comment    as _t_fcomment
from app.email_templates import mention          as _t_mention
from app.email_templates import growth_drip      as _t_gdrip
from app.email_templates import celebration      as _t_celeb
from app.email_templates import social_batch     as _t_sbatch

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
    _v = pick(_t_verify.VARIANTS)
    plain_text = f"Welcome to Monteeq!\n\nYour verification code is: {code}\nExpires in 10 mins."
    content_html = f"""
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;margin:0 0 16px;line-height:1.3;">{_v['heading']}</p>
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:400;color:#8e8e93;margin:0 0 16px;line-height:1.7;">{_v['body']}</p>

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

  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#48484a;margin:0;line-height:1.6;">{_v['caption']}</p>
"""
    html = _base_email_template(content_html)
    return _send_email_logic(to_email, f"{code} is your Monteeq code", plain_text, html)

def send_password_reset_email(to_email: str, token: str) -> bool:
    reset_link = f"{config.FRONTEND_URL}/reset-password?token={token}&email={to_email}"
    plain_text = f"Reset your Monteeq password:\n\nClick here: {reset_link}\n\nThis link expires in 1 hour."
    _v = pick(_t_reset.VARIANTS)
    content_html = f"""
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;margin:0 0 16px;line-height:1.3;text-align:center;">{_v['heading']}</p>
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:400;color:#8e8e93;margin:0 0 16px;line-height:1.7;text-align:center;">{_v['body']}</p>

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
          {_v['security_note']}
        </p>
      </td>
    </tr>
  </table>
"""
    html = _base_email_template(content_html)
    return _send_email_logic(to_email, _v.get("subject", "Reset your Monteeq password"), plain_text, html)

def send_challenge_announcement_batch(bcc_emails: list, title: str, prize: str, end_date: str) -> bool:
    _v = pick(_t_announce.VARIANTS)
    content_html = f"""
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;
             color:#ff3b30;text-transform:uppercase;
             text-align:center;margin:0 0 16px;">{_v['eyebrow']}</p>
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
    {_v['body'].format(title=title, prize=prize, end_date=end_date)}
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
    return _send_email_logic(None, _v['subject'].format(title=title, prize=prize), plain_text, html, bcc_list=bcc_emails)

def send_pro_upgrade_email(to_email: str, username: str) -> bool:
    _v = pick(_t_pro.VARIANTS)
    _heading = _v['heading'].format(username=username)
    _body    = _v['body'].format(username=username)
    content_html = f"""
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;margin:0 0 16px;line-height:1.3;text-align:center;">{_heading}</p>
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:400;color:#8e8e93;margin:0 0 16px;line-height:1.7;text-align:center;">
    {_body}
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
    return _send_email_logic(to_email, _v['subject'].format(username=username), plain_text, html)

def send_challenge_exit_email(to_email: str, username: str, challenge_title: str) -> bool:
    _v = pick(_t_exit.VARIANTS)
    _heading = _v['heading'].format(username=username, challenge_title=challenge_title)
    _body    = _v['body'].format(username=username, challenge_title=challenge_title)
    _followup = _v['followup'].format(username=username, challenge_title=challenge_title)
    content_html = f"""
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;margin:0 0 16px;line-height:1.3;">{_heading}</p>
  <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:400;color:#8e8e93;margin:0 0 16px;line-height:1.7;">
    {_body}
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
    {_followup}
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

# ── Shared style shortcuts ────────────────────────────────────────────────────
_H  = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;margin:0 0 16px;line-height:1.3;"
_B  = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:400;color:#8e8e93;margin:0 0 16px;line-height:1.7;"
_S  = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#48484a;margin:0;line-height:1.6;"
_FF = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"


# ── 1. Welcome (Sign up) ──────────────────────────────────────────────────────
def send_welcome_email(to_email: str, username: str) -> bool:
    _v = pick(_t_welcome.VARIANTS)
    _heading = _v['heading'].format(username=username)
    _body    = _v['body'].format(username=username)
    content_html = f"""
  <p style="{_H}">{_heading}</p>
  <p style="{_B}">{_body}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:24px 0;background:#1a1a1a;border:1px solid #2e2e2e;
                border-top:2px solid #ff3b30;border-radius:8px;overflow:hidden;">
    <tr><td style="padding:14px 20px;border-bottom:1px solid #2e2e2e;">
      <span style="{_FF}color:#ff3b30;font-weight:800;font-size:14px;">01</span>&nbsp;&nbsp;
      <span style="{_FF}color:#fff;font-size:14px;font-weight:600;">Upload your first video</span>
    </td></tr>
    <tr><td style="padding:14px 20px;border-bottom:1px solid #2e2e2e;">
      <span style="{_FF}color:#ff3b30;font-weight:800;font-size:14px;">02</span>&nbsp;&nbsp;
      <span style="{_FF}color:#fff;font-size:14px;font-weight:600;">Complete your creator profile</span>
    </td></tr>
    <tr><td style="padding:14px 20px;">
      <span style="{_FF}color:#ff3b30;font-weight:800;font-size:14px;">03</span>&nbsp;&nbsp;
      <span style="{_FF}color:#fff;font-size:14px;font-weight:600;">Explore the community feed</span>
    </td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button("Upload Your First Video", "https://monteeq.com/upload")}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"Welcome to Monteeq, {username}! Upload your first video at https://monteeq.com/upload"
    return _send_email_logic(to_email, f"Welcome to Monteeq, {username}", plain, html)


# ── 2. Day-3 onboarding nudge ─────────────────────────────────────────────────
def send_day3_nudge_email(to_email: str, username: str) -> bool:
    _v = pick(_t_day3.VARIANTS)
    _heading = _v['heading'].format(username=username)
    _body    = _v['body'].format(username=username)
    content_html = f"""
  <p style="{_H}">{_heading}</p>
  <p style="{_B}">{_body}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button("Upload a Video", "https://monteeq.com/upload")}</td></tr>
  </table>
  <p style="{_S};margin-top:20px;text-align:center;">Takes less than 2 minutes.</p>
"""
    html = _base_email_template(content_html)
    plain = f"Hey {username}, upload your first video at https://monteeq.com/upload"
    return _send_email_logic(to_email, _v['subject'].format(username=username), plain, html)


# ── 3. First video uploaded (milestone) ──────────────────────────────────────
def send_first_video_email(to_email: str, username: str, video_title: str, video_url: str) -> bool:
    _v = pick(_t_fvideo.VARIANTS)
    _heading = _v['heading'].format(username=username, video_title=video_title)
    _body    = _v['body'].format(username=username, video_title=video_title)
    _tip     = _v['tip'].format(username=username, video_title=video_title)
    content_html = f"""
  <p style="{_H}">{_heading}</p>
  <p style="{_B}">{_body}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:24px 0;background:#1a1a1a;border-left:3px solid #ff3b30;
                border-radius:0 6px 6px 0;padding:0;">
    <tr><td style="padding:16px 20px;">
      <p style="{_S}margin:0 0 4px;text-transform:uppercase;letter-spacing:2px;font-weight:700;">What to do next</p>
      <p style="{_FF}font-size:14px;color:#8e8e93;margin:0;line-height:1.6;">
        {_tip}
      </p>
    </td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button("View Your Video", video_url)}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"Your video '{video_title}' is live on Monteeq. View it at {video_url}"
    return _send_email_logic(to_email, _v['subject'].format(username=username, video_title=video_title), plain, html)


# ── 4. First follower (social) ────────────────────────────────────────────────
def send_first_follower_email(to_email: str, username: str, follower_name: str) -> bool:
    _v = pick(_t_ffollower.VARIANTS)
    _heading = _v['heading'].format(username=username, follower_name=follower_name)
    _body    = _v['body'].format(username=username, follower_name=follower_name)
    content_html = f"""
  <p style="{_H}">{_heading}</p>
  <p style="{_B}">{_body}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button("See Your Profile", f"https://monteeq.com/u/{username}")}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"{follower_name} just followed you on Monteeq."
    return _send_email_logic(to_email, _v['subject'].format(username=username, follower_name=follower_name), plain, html)


# ── 5. First like (social) ────────────────────────────────────────────────────
def send_first_like_email(to_email: str, username: str, video_title: str, liker_name: str, video_url: str) -> bool:
    _v = pick(_t_flike.VARIANTS)
    _heading = _v['heading'].format(username=username, video_title=video_title, liker_name=liker_name)
    _body    = _v['body'].format(username=username, video_title=video_title, liker_name=liker_name)
    content_html = f"""
  <p style="{_H}">{_heading}</p>
  <p style="{_B}">{_body}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button("View Your Video", video_url)}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"{liker_name} liked your video '{video_title}'."
    return _send_email_logic(to_email, _v['subject'].format(username=username, video_title=video_title, liker_name=liker_name), plain, html)


# ── 6. Weekly digest (batch) ──────────────────────────────────────────────────
def send_weekly_digest_email(bcc_emails: list, videos: list) -> bool:
    """videos: list of dicts with keys: title, creator, url"""
    _v = pick(_t_digest.WEEKLY_VARIANTS)
    rows_html = ""
    for i, v in enumerate(videos[:5]):
        border = "border-bottom:1px solid #2e2e2e;" if i < len(videos[:5]) - 1 else ""
        rows_html += f"""
    <tr><td style="padding:14px 20px;{border}">
      <a href="{v.get('url','https://monteeq.com')}"
         style="{_FF}font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;display:block;">
        {v.get('title','Untitled')}
      </a>
      <span style="{_FF}font-size:12px;color:#48484a;">{v.get('creator','')}</span>
    </td></tr>"""

    content_html = f"""
  <p style="{_H}">{_v['heading']}</p>
  <p style="{_B}">{_v['body']}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:24px 0;background:#1a1a1a;border:1px solid #2e2e2e;
                border-top:2px solid #ff3b30;border-radius:8px;overflow:hidden;">
    {rows_html}
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button("Open Your Feed", "https://monteeq.com")}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = "This week's top videos on Monteeq — https://monteeq.com"
    return _send_email_logic(None, _v['subject'], plain, html, bcc_list=bcc_emails)


# ── 7. Monthly stats digest ───────────────────────────────────────────────────
def send_monthly_stats_email(to_email: str, username: str, month: str, stats: dict) -> bool:
    """stats: dict with keys: views, likes, followers, uploads"""
    _v = pick(_t_digest.MONTHLY_VARIANTS)
    _heading = _v['heading'].format(username=username, month=month)
    _body    = _v['body'].format(username=username, month=month)
    def stat_cell(label, value):
        return f"""<td align="center" style="padding:20px;width:50%;">
          <p style="{_FF}font-size:28px;font-weight:900;color:#ffffff;margin:0 0 4px;">{value}</p>
          <p style="{_S}{_FF}text-transform:uppercase;letter-spacing:2px;font-weight:700;">{label}</p>
        </td>"""

    content_html = f"""
  <p style="{_H}">{_heading}</p>
  <p style="{_B}">{_body}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:24px 0;background:#1a1a1a;border:1px solid #2e2e2e;
                border-top:2px solid #ff3b30;border-radius:8px;overflow:hidden;">
    <tr>
      {stat_cell("Views", stats.get("views", 0))}
      <td style="width:1px;background:#2e2e2e;font-size:0;">&nbsp;</td>
      {stat_cell("Likes", stats.get("likes", 0))}
    </tr>
    <tr><td colspan="3" style="background:#2e2e2e;font-size:0;height:1px;">&nbsp;</td></tr>
    <tr>
      {stat_cell("New Followers", stats.get("followers", 0))}
      <td style="width:1px;background:#2e2e2e;font-size:0;">&nbsp;</td>
      {stat_cell("Uploads", stats.get("uploads", 0))}
    </tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button("View Full Analytics", "https://monteeq.com/analytics")}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"{username}'s {month} on Monteeq — {stats.get('views',0)} views, {stats.get('likes',0)} likes."
    return _send_email_logic(to_email, _v['subject'].format(username=username, month=month), plain, html)


# ── 8. Re-engagement (30 days inactive) ──────────────────────────────────────
def send_reengagement_email(to_email: str, username: str, inactive_days: int = 30) -> bool:
    _v = _t_reeng.pick_reengagement(inactive_days)
    _heading = _v['heading'].format(username=username)
    _body_1  = _v['body_1'].format(username=username)
    _body_2  = _v['body_2'].format(username=username)
    content_html = f"""
  <p style="{_H}">{_heading}</p>
  <p style="{_B}">{_body_1}</p>
  <p style="{_B}">{_body_2}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button("Upload a Video", "https://monteeq.com/upload")}</td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
    <tr><td align="center">
      <a href="https://monteeq.com"
         style="{_FF}font-size:13px;color:#48484a;text-decoration:none;">
        Or just browse the feed
      </a>
    </td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"Hey {username}, we haven't seen you in {inactive_days} days. Come back to Monteeq: https://monteeq.com"
    return _send_email_logic(to_email, _v['subject'].format(username=username), plain, html)


# ── 9. Challenge ending soon (campaign, batch) ────────────────────────────────
def send_challenge_ending_soon_email(bcc_emails: list, title: str, prize: str, end_date: str) -> bool:
    _v = pick(_t_ending.VARIANTS)
    content_html = f"""
  <p style="{_FF}font-size:11px;font-weight:700;letter-spacing:3px;color:#ff3b30;
             text-transform:uppercase;text-align:center;margin:0 0 16px;">{_v['eyebrow']}</p>
  <p style="{_H}text-align:center;">{title}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr><td align="center"
        style="background:#1a1a1a;border:1px solid #2e2e2e;
               border-top:2px solid #ff3b30;border-radius:8px;padding:28px;">
      <p style="{_S}{_FF}text-transform:uppercase;letter-spacing:3px;font-weight:700;margin:0 0 6px;">
        Prize Pool
      </p>
      <p style="{_FF}font-size:40px;font-weight:900;color:#ffffff;margin:0;">{prize}</p>
      <p style="{_FF}font-size:13px;color:#ff3b30;font-weight:700;margin:8px 0 0;">
        Closes {end_date}
      </p>
    </td></tr>
  </table>

  <p style="{_B}text-align:center;">{_v['body'].format(title=title, prize=prize, end_date=end_date)}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button("Enter Now", "https://monteeq.com/challenges")}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"Last chance to enter {title} — prize: {prize}. Closes {end_date}. Enter at https://monteeq.com/challenges"
    return _send_email_logic(None, _v['subject'].format(title=title, prize=prize, end_date=end_date), plain, html, bcc_list=bcc_emails)


# ── 10. Challenge result / winner announcement (batch) ───────────────────────
def send_challenge_result_email(bcc_emails: list, challenge_title: str, winner_name: str,
                                winner_video_url: str, prize: str) -> bool:
    _v = pick(_t_result.VARIANTS)
    _eyebrow = _v['eyebrow'].format(challenge_title=challenge_title, winner_name=winner_name, prize=prize)
    _heading = _v['heading'].format(challenge_title=challenge_title, winner_name=winner_name, prize=prize)
    _body    = _v['body'].format(challenge_title=challenge_title, winner_name=winner_name, prize=prize)
    content_html = f"""
  <p style="{_FF}font-size:11px;font-weight:700;letter-spacing:3px;color:#ff3b30;
             text-transform:uppercase;text-align:center;margin:0 0 16px;">{_eyebrow}</p>
  <p style="{_H}text-align:center;">{_heading}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:24px 0;background:#1a1a1a;border:1px solid #2e2e2e;
                border-top:2px solid #ff3b30;border-radius:8px;overflow:hidden;">
    <tr><td align="center" style="padding:28px;">
      <p style="{_S}{_FF}text-transform:uppercase;letter-spacing:3px;font-weight:700;margin:0 0 8px;">Winner</p>
      <p style="{_FF}font-size:26px;font-weight:900;color:#ffffff;margin:0 0 4px;">{winner_name}</p>
      <p style="{_FF}font-size:14px;color:#ff3b30;font-weight:700;margin:0;">Took home {prize}</p>
    </td></tr>
  </table>

  <p style="{_B}text-align:center;">
    {_body}
  </p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button("Watch the Winning Edit", winner_video_url)}</td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
    <tr><td align="center">
      <a href="https://monteeq.com/challenges"
         style="{_FF}font-size:13px;color:#48484a;text-decoration:none;">
        More challenges are open
      </a>
    </td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"{winner_name} won {challenge_title} and took home {prize}. Watch at {winner_video_url}"
    return _send_email_logic(None, _v['subject'].format(challenge_title=challenge_title, winner_name=winner_name, prize=prize), plain, html, bcc_list=bcc_emails)


def send_security_email(to_email: str, template_type: str, username: str, **kwargs) -> bool:
    _v = _t_sec.pick_security(template_type)
    subject = _v['subject'].format(username=username, **kwargs)
    heading = _v['heading'].format(username=username, **kwargs)
    body = _v['body'].format(username=username, **kwargs)
    action_text = _v.get('action_text', 'Secure Account')
    body_html = body.replace('\n', '<br>')
    content_html = f"""
  <p style="{_H}">{heading}</p>
  <p style="{_B}">{body_html}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button(action_text, "https://monteeq.com/settings/security")}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"{heading}\n\n{body}"
    return _send_email_logic(to_email, subject, plain, html)


def send_subscription_email(to_email: str, template_type: str, username: str, **kwargs) -> bool:
    _v = _t_sub.pick_subscription(template_type)
    subject = _v['subject'].format(username=username, **kwargs)
    heading = _v['heading'].format(username=username, **kwargs)
    body = _v['body'].format(username=username, **kwargs)
    action_text = _v.get('action_text', 'Learn More')
    body_html = body.replace('\n', '<br>')
    content_html = f"""
  <p style="{_H}">{heading}</p>
  <p style="{_B}">{body_html}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button(action_text, "https://monteeq.com/pro")}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"{heading}\n\n{body}"
    return _send_email_logic(to_email, subject, plain, html)


def send_first_comment_email(to_email: str, username: str, video_title: str, commenter_name: str, comment_content: str, video_url: str) -> bool:
    _v = pick(_t_fcomment.VARIANTS)
    fmt = {
        "username": username,
        "video_title": video_title,
        "commenter_name": commenter_name,
        "comment_content": comment_content,
    }
    subject = _v['subject'].format(**fmt)
    heading = _v['heading'].format(**fmt)
    body = _v['body'].format(**fmt)
    action_text = _v.get('action_text', 'View Comment')
    body_html = body.replace('\n', '<br>')
    content_html = f"""
  <p style="{_H}">{heading}</p>
  <p style="{_B}">{body_html}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button(action_text, video_url)}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"{heading}\n\n{body}"
    return _send_email_logic(to_email, subject, plain, html)


def send_mention_email(to_email: str, username: str, mentioner_name: str, context_text: str, action_url: str) -> bool:
    _v = pick(_t_mention.VARIANTS)
    fmt = {
        "username": username,
        "mentioner_name": mentioner_name,
        "context_text": context_text,
    }
    subject = _v['subject'].format(**fmt)
    heading = _v['heading'].format(**fmt)
    body = _v['body'].format(**fmt)
    action_text = _v.get('action_text', 'View Mention')
    body_html = body.replace('\n', '<br>')
    content_html = f"""
  <p style="{_H}">{heading}</p>
  <p style="{_B}">{body_html}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button(action_text, action_url)}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"{heading}\n\n{body}"
    return _send_email_logic(to_email, subject, plain, html)



def send_growth_drip_email(to_email: str, username: str, week: int) -> bool:
    _v = _t_gdrip.pick_growth_drip(week)
    subject = _v['subject'].format(username=username)
    heading = _v['heading'].format(username=username)
    body = _v['body'].format(username=username)
    action_text = _v.get('action_text', 'Learn More')
    body_html = body.replace('\n', '<br>')
    content_html = f"""
  <p style="{_H}">{heading}</p>
  <p style="{_B}">{body_html}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button(action_text, "https://monteeq.com/settings/profile")}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"{heading}\n\n{body}"
    return _send_email_logic(to_email, subject, plain, html)


def send_celebration_email(to_email: str, username: str, template_type: str, **kwargs) -> bool:
    _v = _t_celeb.pick_celebration(template_type)
    subject = _v['subject'].format(username=username, **kwargs)
    heading = _v['heading'].format(username=username, **kwargs)
    body = _v['body'].format(username=username, **kwargs)
    action_text = _v.get('action_text', 'View Milestone')
    body_html = body.replace('\n', '<br>')
    content_html = f"""
  <p style="{_H}">{heading}</p>
  <p style="{_B}">{body_html}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button(action_text, "https://monteeq.com")}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"{heading}\n\n{body}"
    return _send_email_logic(to_email, subject, plain, html)


def send_social_batch_email(to_email: str, username: str, summary_text: str) -> bool:
    _v = _t_sbatch.pick_social_batch()
    subject = _v['subject'].format(username=username)
    heading = _v['heading'].format(username=username)
    body = _v['body'].format(username=username, summary_text=summary_text)
    action_text = _v.get('action_text', 'View Notifications')
    body_html = body.replace('\n', '<br>')
    content_html = f"""
  <p style="{_H}">{heading}</p>
  <p style="{_B}">{body_html}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr><td align="center">{_primary_button(action_text, "https://monteeq.com/notifications")}</td></tr>
  </table>
"""
    html = _base_email_template(content_html)
    plain = f"{heading}\n\n{body}"
    return _send_email_logic(to_email, subject, plain, html)


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
