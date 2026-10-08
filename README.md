# K-Net — K Network Project Center

Production-coordination platform for large-scale film shoots: scheduling, logistics,
staff management, communication, documents and finance in one place.
Planning docs and brand source files are kept locally in `dev/` and are not part of the repo.

## Stack

| Part | Tech |
| --- | --- |
| Backend | Django 6 + Django REST Framework (`backend/`) |
| Frontend | React 19 + TypeScript on Vite (`frontend/`) |
| Database | SQLite in development, PostgreSQL in production |
| Auth | Django session auth with CSRF protection |

In development, Vite (port 5173) proxies `/api`, `/admin` and `/media` to Django
(port 8000), so the browser sees a single origin.

## Roles

| Role | Summary |
| --- | --- |
| Site Manager | All permissions, Django admin access, adds trackers, creates Directors and Assistants |
| Director | Manages staff, schedule, resources, documents, finance; creates Assistants and Staff |
| Assistant | Same permissions as Director |
| Staff | Views shared info; own schedule, tasks and receipts |

Permissions are enforced in the API (`backend/accounts/permissions.py`, serializers).
The frontend hides pages to match, but the server is the source of truth.

## Getting started

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # then set DJANGO_SECRET_KEY
python manage.py migrate
python manage.py seed_demo    # optional demo accounts (DEBUG only)
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

### Demo accounts

Don't run `seed_demo` on the alpha/trial database: it re-creates the demo accounts below.

After `seed_demo`, every account uses the password `knet-demo-2026`:

- `coachk@knet.test`, `babes@knet.test` (Directors)
- `rachel@knet.test` (Site Manager)
- `jared@knet.test` (Assistant, Logistics)
- `jimmy@knet.test` (Staff, Tech), plus other staff in Tech, Logistics and Film Crew

`python manage.py load_tampa_resources` adds verified Tampa-area vendors to the Resources Directory
(safe to run again; it updates existing entries by name).

`python manage.py import_influencers <file.csv>` adds or updates Influencer Roster entries from a CSV
(needs a `name` column; matches existing influencers by name).

`python manage.py seed_demo --reset` deletes the demo accounts and demo content and re-creates them
(production settings, departments and non-demo accounts are kept).

## Sign-up and email verification

Anyone can create an account at `/signup` (first and last name, email, phone, a password with at
least 10 characters including a capital letter, a number and a special character, and agreement to
the privacy statement). New accounts are Staff and can't log in until they open the link in the
verification email; the link logs them in and works once, for 3 days. Accounts that Directors and
Assistants add themselves don't need verifying. Sign-up and resend are rate-limited per IP, and a
hidden form field catches simple bots.

Emails are sent from `SUPPORT_EMAIL` (support.knet@gmail.com) through Gmail. Turn on 2-Step
Verification for that Google account, create an app password (Google Account > Security > App
passwords) and put it in `EMAIL_APP_PASSWORD`. Without it, emails are printed to the `runserver`
console. Set `SITE_URL` to the public address so the links in emails point to the right place.

The **Invite Crew** page (Staff / Crew > Invite Crew) shows a QR code and link to the sign-up
page for the address K-Net is running at, with download, share and print options.

## Slack notifications

K-Net can post announcements and alerts to Slack channels and send people a direct message
when they're assigned a task. Messages are a short summary plus a link back to K-Net, so
role-restricted details (finance, emergency contacts, CrewFinder locations) stay in the app.
It's off unless `SLACK_BOT_TOKEN` is set.

1. At https://api.slack.com/apps, create an app ("From scratch") in the production's workspace.
2. Under **OAuth & Permissions**, add the bot scopes `chat:write`, `users:read` and
   `users:read.email`, then **Install to Workspace** and copy the Bot User OAuth Token (`xoxb-…`).
3. In `backend/.env`, set `SLACK_BOT_TOKEN`, `SLACK_ANNOUNCEMENTS_CHANNEL` (and optionally
   `SLACK_ALERTS_CHANNEL`), and `SITE_URL` (the app's public address, for links).
4. In Slack, invite the bot to each channel: `/invite @<app name>`.
5. Check it: `python manage.py slack_check --post --email you@example.com`.

People are matched to Slack by email. If someone's Slack email differs from their K-Net email,
a Site Manager can enter their Slack member ID in the Django admin. Everyone can turn task
messages off on their Account page.

## Checks

```bash
cd backend && python manage.py test
cd frontend && npm run lint && npm run build
```

## Branding

- Dark red `#880101`, red `#D60000`, black `#000000`
- Font: Tw Cen MT (Regular / Bold / Italic), used when installed (it ships with Microsoft
  Office). Jost from Google Fonts is the fallback everywhere else; embedding Tw Cen MT itself
  needs a web font license from Monotype.
