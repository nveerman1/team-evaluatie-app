# Outbound Email via TransIP SMTP

The backend sends transactional emails (evaluation reminders, competency-review
invitations, project-assessment invitations) using Python's built-in `smtplib`
with STARTTLS.

---

## Required environment variables

| Variable | Description | TransIP value |
|---|---|---|
| `SMTP_HOST` | SMTP server hostname | `smtp.transip.email` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USERNAME` | SMTP login (usually the From address) | `noreply@technasiummbh.nl` |
| `SMTP_PASSWORD` | SMTP password from TransIP control panel | *(secret)* |
| `SMTP_USE_STARTTLS` | Upgrade connection with STARTTLS | `true` |
| `SMTP_FROM_NAME` | Display name in the *From* header | `Technasium MBH App` |
| `SMTP_FROM_EMAIL` | Address in the *From* header | `noreply@technasiummbh.nl` |
| `SMTP_REPLY_TO` | Reply-To address (optional) | `support@technasiummbh.nl` |
| `SMTP_TIMEOUT` | TCP connection timeout (seconds) | `10` |

Copy the values from `backend/.env.production.example` and fill in your real
`SMTP_PASSWORD`.  **Never commit the password to source control.**

---

## TransIP setup checklist

1. Log into the [TransIP control panel](https://www.transip.nl/cp/).
2. Navigate to **E-mail → Mailboxes** and create (or verify) the mailbox
   `noreply@technasiummbh.nl`.
3. Note the SMTP password — it is used for `SMTP_PASSWORD`.
4. Outbound settings:
   - Host: `smtp.transip.email`
   - Port: `587`
   - Security: **STARTTLS** (not SSL/TLS, not plain)
   - Authentication: **LOGIN** with the full email address as the username

---

## DNS — SPF / DKIM / DMARC

TransIP automatically publishes an SPF record for hosted mailboxes.
Verify it is present with:

```bash
dig TXT technasiummbh.nl | grep spf
```

For DKIM, enable it in the TransIP control panel under **DNS → E-mail
beveiliging** and copy the generated TXT record to your DNS zone.

A minimal DMARC record (monitoring-only) can be added to DNS:

```
_dmarc.technasiummbh.nl. 300 IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@technasiummbh.nl"
```

Tighten the policy to `p=quarantine` or `p=reject` once you are confident all
legitimate senders are covered.

---

## Rate limits

TransIP shared SMTP has a default limit of **500 messages per day** for hosted
mailboxes.  If you need higher throughput, consider TransIP's dedicated SMTP
add-on or a dedicated transactional email service (SendGrid, Postmark, etc.).

The application sends at most one email per student per reminder action, so the
default limit is sufficient for typical school deployments.

---

## Testing the connection locally

```bash
python - <<'EOF'
import smtplib, os

host = os.environ["SMTP_HOST"]
port = int(os.environ.get("SMTP_PORT", 587))
user = os.environ["SMTP_USERNAME"]
pw   = os.environ["SMTP_PASSWORD"]

with smtplib.SMTP(host, port, timeout=10) as s:
    s.ehlo()
    s.starttls()
    s.ehlo()
    s.login(user, pw)
    print("SMTP login OK")
EOF
```

---

## Disabling email sending

Leave `SMTP_HOST` empty (or unset) to disable outbound email entirely.  The
application will log a warning and fall back to simulation mode (no emails are
sent, but the API responses still indicate what *would* have been sent).
