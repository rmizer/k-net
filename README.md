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

- `manager@knet.test` (Site Manager)
- `director@knet.test` (Director)
- `assistant@knet.test` (Assistant)
- `robert@knet.test` (Staff, Tech), plus other crew in Tech, Logistics and Film Crew

## Checks

```bash
cd backend && python manage.py test
cd frontend && npm run lint && npm run build
```

## Branding

- Dark red `#880101`, red `#D60000`, black `#000000`
- Font: All Genders V4 (Lite / Regular / Bold). Web font files still need to be
  added to `frontend/public/fonts/` (see the note at the top of `frontend/src/index.css`);
  Fira Sans is the fallback until then.
