"""HTML builders for notification emails. Inline styles only — email clients
strip <style> blocks and external stylesheets unpredictably. Colors and type
follow the InfoBeans Brand OS: Charcoal Gray body text, Light Cream/White
backgrounds, Brand Red used once per email as the single accent (the CTA
button), sentence-case headings, sharp (non-rounded) corners throughout.

Every document declares <meta charset="utf-8"> — without it, some clients
guess the wrong encoding and multi-byte characters (em dashes, curly quotes)
render as mojibake ("â€"). This must stay on every _layout()/error_alert()
call; do not strip it for brevity.
"""

from datetime import datetime, timezone
from decimal import Decimal

from app.core.config import settings

_CHARCOAL = "#373742"
_SIDEBAR = "#2f2f39"  # frontend/src/index.css --sidebar — the gradient's start color
_BLACK = "#000000"
_MEDIUM_GRAY = "#676775"
_LIGHT_CREAM = "#FFF9ED"
_LIGHT_GRAY = "#E6E6ED"
_BRAND_RED = "#EA1B3D"
_WHITE = "#FFFFFF"

_FONT_STACK = "'Lexend', Arial, Helvetica, sans-serif"

# Referenced as a CID-embedded inline image (see email_service.py), not a
# hosted URL — two reasons: (1) Gmail (and several other major clients)
# doesn't render SVG in email bodies at all, and silently drops data-URI
# images too, so neither the original SVG-via-URL nor a data-URI worked in
# testing; (2) a CID attachment travels inside the email itself, so it has
# no dependency on the frontend being deployed/reachable. The PNG lives at
# app/assets/email-logo.png — email_service.py attaches it with this same
# Content-ID whenever a template using it is sent.
LOGO_CID = "infobeans-logo"

_HEAD = (
    '<meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width, initial-scale=1">'
    "<title>Marketing Spend Portal</title>"
)


def format_amount(amount: Decimal | None, currency: str) -> str:
    if amount is None:
        return "Not set"
    return f"{currency} {amount:,.2f}"


def _cta_button(label: str, url: str) -> str:
    return (
        f'<a href="{url}" style="background-color:{_BRAND_RED};color:{_WHITE};text-decoration:none;'
        f'padding:12px 24px;font-size:14px;display:inline-block;">{label}</a>'
    )


def _details_table(rows: list[tuple[str, str]]) -> str:
    """A sharp-edged, bordered label/value box — the "here are the details"
    block every submission email includes so the reader doesn't have to
    click through just to see what they're being asked to review."""
    if not rows:
        return ""
    row_html = "".join(
        f"""<tr>
              <td style="padding:10px 16px;border-bottom:1px solid {_LIGHT_GRAY};font-size:12px;
                  color:{_MEDIUM_GRAY};white-space:nowrap;vertical-align:top;width:40%;">{label}</td>
              <td style="padding:10px 16px;border-bottom:1px solid {_LIGHT_GRAY};font-size:13px;
                  color:{_CHARCOAL};vertical-align:top;">{value}</td>
            </tr>"""
        for label, value in rows
    )
    return f"""\
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin-top:16px;border:1px solid {_LIGHT_GRAY};border-collapse:collapse;">
  {row_html}
</table>"""


# The app's own header lockup (frontend/src/components/BrandLockup.tsx,
# "dark" variant): "Spend" in white + "Track" in Brand Red with a red
# underline bar, a divider, then the InfoBeans mark — rebuilt here in table
# markup since email can't use flexbox/CSS custom properties. The whole
# thing links to the app (frontend_base_url), like clicking the sidebar logo
# there does. background-color is the fallback for clients that ignore
# background-image on a <td> (several do) — same diagonal charcoal-to-black
# gradient AppSidebar.tsx uses behind this exact lockup.
_BRAND_HEADER = f"""\
<a href="{settings.frontend_base_url}" style="text-decoration:none;">
<table role="presentation" cellpadding="0" cellspacing="0">
  <tr>
    <td style="vertical-align:middle;">
      <div style="font-size:20px;font-weight:700;line-height:1;color:{_WHITE};font-family:{_FONT_STACK};">
        Spend<span style="color:{_BRAND_RED};">Track</span>
      </div>
      <div style="margin-top:6px;height:3px;width:52px;background-color:{_BRAND_RED};"></div>
    </td>
    <td style="padding:0 16px;vertical-align:middle;">
      <div style="width:1px;height:26px;background-color:rgba(255,255,255,0.2);font-size:0;line-height:0;">&nbsp;</div>
    </td>
    <td style="vertical-align:middle;">
      <img src="cid:{LOGO_CID}" alt="InfoBeans" height="22" style="display:block;height:22px;border:0;">
    </td>
  </tr>
</table>
</a>"""

_HEADER_CELL_STYLE = (
    f"background-color:{_SIDEBAR};"
    f"background-image:linear-gradient(135deg, {_SIDEBAR}, {_BLACK});"
    "padding:20px 32px;"
)


def _layout(
    *, preheader: str, heading: str, body_html: str, cta_label: str, cta_url: str, show_bottom_cta: bool = True
) -> str:
    bottom_cta = (
        f"""<div style="margin-top:28px;">
                  {_cta_button(cta_label, cta_url)}
                </div>"""
        if show_bottom_cta
        else ""
    )
    return f"""\
<!doctype html>
<html lang="en">
  <head>
    {_HEAD}
  </head>
  <body style="margin:0;padding:0;background-color:{_LIGHT_GRAY};font-family:{_FONT_STACK};">
    <span style="display:none;font-size:1px;color:{_LIGHT_CREAM};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      {preheader}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{_LIGHT_GRAY};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background-color:{_WHITE};border:1px solid {_LIGHT_GRAY};">
            <tr>
              <td style="{_HEADER_CELL_STYLE}">
                {_BRAND_HEADER}
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;font-weight:300;color:{_CHARCOAL};">{heading}</h1>
                <div style="font-size:14px;line-height:1.6;color:{_MEDIUM_GRAY};font-weight:300;">
                  {body_html}
                </div>
                {bottom_cta}
              </td>
            </tr>
            <tr>
              <td style="background-color:{_LIGHT_CREAM};padding:16px 32px;border-top:1px solid {_LIGHT_GRAY};">
                <span style="font-size:11px;color:{_MEDIUM_GRAY};">
                  Automated notification from the Marketing Spend Portal — no need to reply to this email.
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def new_initiative_created(
    *, initiative_name: str, actor_name: str, details: list[tuple[str, str]], url: str
) -> tuple[str, str]:
    subject = f"New initiative for approval: {initiative_name}"
    body = _layout(
        preheader=f"{actor_name} submitted '{initiative_name}' for your approval.",
        heading="A new initiative needs your review",
        body_html=(
            f"<p><strong style='color:{_CHARCOAL};'>{actor_name}</strong> submitted a new initiative, "
            f"<strong style='color:{_CHARCOAL};'>{initiative_name}</strong>, for approval.</p>"
            f"<div style='margin:16px 0;'>{_cta_button('Review initiative', url)}</div>"
            f"{_details_table(details)}"
        ),
        cta_label="Review initiative",
        cta_url=url,
        show_bottom_cta=False,
    )
    return subject, body


def new_spend_request_created(
    *, spend_request_description: str, initiative_name: str, actor_name: str, details: list[tuple[str, str]], url: str
) -> tuple[str, str]:
    subject = f"New spend request for approval: {spend_request_description}"
    body = _layout(
        preheader=f"{actor_name} submitted a spend request under '{initiative_name}' for your approval.",
        heading="A new spend request needs your review",
        body_html=(
            f"<p><strong style='color:{_CHARCOAL};'>{actor_name}</strong> submitted a spend request, "
            f"<strong style='color:{_CHARCOAL};'>{spend_request_description}</strong>, under initiative "
            f"<strong style='color:{_CHARCOAL};'>{initiative_name}</strong>.</p>"
            f"<div style='margin:16px 0;'>{_cta_button('Review spend request', url)}</div>"
            f"{_details_table(details)}"
        ),
        cta_label="Review spend request",
        cta_url=url,
        show_bottom_cta=False,
    )
    return subject, body


def initiative_decision_made(
    *, initiative_name: str, decision: str, approver_name: str, comment: str | None, url: str
) -> tuple[str, str]:
    decision_label = "approved" if decision == "approved" else "rejected"
    subject = f"Your initiative was {decision_label}: {initiative_name}"
    comment_html = f"<p style='margin-top:12px;'><em>\"{comment}\"</em> — {approver_name}</p>" if comment else ""
    body = _layout(
        preheader=f"{approver_name} {decision_label} your initiative '{initiative_name}'.",
        heading=f"Your initiative was {decision_label}",
        body_html=(
            f"<p><strong style='color:{_CHARCOAL};'>{approver_name}</strong> {decision_label} your initiative "
            f"<strong style='color:{_CHARCOAL};'>{initiative_name}</strong>.</p>{comment_html}"
        ),
        cta_label="View initiative",
        cta_url=url,
    )
    return subject, body


def error_alert(
    *, status_code: int, method: str, path: str, message: str, user_email: str | None, stack_trace: str | None
) -> tuple[str, str]:
    """Only ever called for genuine server-side failures (see app/main.py's
    _alert_task — ordinary 4xx never reaches here), formatted like a
    status-page incident notice (heading, status, time, affected component)
    rather than a bare stack-trace dump, so the one email this app sends
    unprompted reads as "something is actually broken," not routine noise."""
    subject = f"[SpendTrack Incident] Server error on {method} {path}"
    summary = f"We're seeing a server error ({status_code}) on {method} {path}."
    posted_at = datetime.now(timezone.utc).strftime("%b %d, %Y %H:%M UTC")
    rows = [
        ("Incident status", "Identified"),
        ("Time posted", posted_at),
        ("Components affected", f"Backend API — {method} {path}"),
    ]
    if user_email:
        rows.append(("Affected user", user_email))
    trace_html = (
        f"<pre style='background-color:{_LIGHT_GRAY};color:{_CHARCOAL};padding:12px;"
        f"font-size:12px;overflow-x:auto;white-space:pre-wrap;margin-top:16px;'>{stack_trace}</pre>"
        if stack_trace
        else ""
    )
    body_html = (
        f"<p>{summary}</p>"
        f"{_details_table(rows)}"
        f"<p style='margin-top:20px;font-size:12px;color:{_MEDIUM_GRAY};'>Error message: {message}</p>"
        f"{trace_html}"
    )
    body = _layout(
        preheader=summary,
        heading="Elevated errors detected",
        body_html=body_html,
        cta_label="",
        cta_url="",
        show_bottom_cta=False,
    )
    return subject, body


def spend_request_decision_made(
    *, spend_request_description: str, decision_label: str, approver_name: str, comment: str | None, url: str
) -> tuple[str, str]:
    subject = f"Your spend request was {decision_label}: {spend_request_description}"
    comment_html = f"<p style='margin-top:12px;'><em>\"{comment}\"</em> — {approver_name}</p>" if comment else ""
    body = _layout(
        preheader=f"{approver_name} made a decision on your spend request '{spend_request_description}'.",
        heading=f"Your spend request was {decision_label}",
        body_html=(
            f"<p><strong style='color:{_CHARCOAL};'>{approver_name}</strong> {decision_label} your spend request "
            f"<strong style='color:{_CHARCOAL};'>{spend_request_description}</strong>.</p>{comment_html}"
        ),
        cta_label="View spend request",
        cta_url=url,
    )
    return subject, body
