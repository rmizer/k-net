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
