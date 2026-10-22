"""
Django settings for the K-Net backend.

Environment-specific values are read from environment variables (optionally
loaded from backend/.env). See .env.example for the full list.
"""

import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).lower() in ("1", "true", "yes", "on")


def env_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


DEBUG = env_bool("DJANGO_DEBUG", False)

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is off.")
    SECRET_KEY = "dev-only-insecure-key-do-not-use-in-production"

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

# The React dev server (Vite) proxies /api, /admin and /media to Django, so the
# browser sees a single origin. These origins are trusted for CSRF checks.
CSRF_TRUSTED_ORIGINS = env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "accounts",
    "core",
    "announcements",
    "tasks",
    "schedule",
    "crewfinder",
    "resources",
    "influencers",
    "shows",
    "meetings",
    "departments",
    "culinary",
    "documents",
    "locations",
    "finance",
    "notifications",
    "support",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serves the built React app and the admin's static files in production.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middleware.ProductionTimeZoneMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# SQLite for local development; production sets DATABASE_URL (PostgreSQL on Railway).

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
    )
}


# Authentication

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {"NAME": "accounts.validators.PasswordComplexityValidator"},
]

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG


# HTTPS (production)
# Railway terminates HTTPS and forwards requests with X-Forwarded-Proto.

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SSL_REDIRECT", True)
    # Railway's health check calls the app directly over HTTP.
    SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]
    # Starts short; raise it (e.g. 31536000) once HTTPS is confirmed working.
    SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", "3600"))


# Django REST Framework

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    # Per-IP limits on the public sign-up endpoints, to slow down bots.
    "DEFAULT_THROTTLE_RATES": {
        "signup": "10/hour",
        "verification": "20/hour",
        "support": "20/hour",
    },
}

# The app's public address (e.g. https://knet.example.com), used for links in
# verification emails and Slack messages.
SITE_URL = os.environ.get("SITE_URL", "http://localhost:5173")


# Internationalization
# Requests run in the production's time zone (set from its location; see
# core.middleware). TIME_ZONE is only the fallback outside requests.

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# Static and uploaded files

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

# The built React app (frontend/dist). In production Django serves it: its
# files at the site root, and index.html for every page route (see config.urls).
FRONTEND_DIST = Path(os.environ.get("FRONTEND_DIST", BASE_DIR.parent / "frontend" / "dist"))
WHITENOISE_ROOT = FRONTEND_DIST if FRONTEND_DIST.is_dir() else None

# Uploads live under DATA_DIR, which in production is a persistent volume
# (Railway: mount one at /data and set DATA_DIR=/data).
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR))
MEDIA_URL = "media/"
MEDIA_ROOT = DATA_DIR / "media"
# Uploaded documents; never served directly, only through the API.
PRIVATE_MEDIA_ROOT = DATA_DIR / "private"


# Email
# Sent from the support Gmail account through Gmail's SMTP server, using an app
# password (Google Account > Security > App passwords). Without one, emails
# are printed to the console instead.

SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL", "support.knet@gmail.com")
DEFAULT_FROM_EMAIL = f"K-Net Support <{SUPPORT_EMAIL}>"
EMAIL_APP_PASSWORD = os.environ.get("EMAIL_APP_PASSWORD", "")

if EMAIL_APP_PASSWORD:
    MAILERS = {
        "default": {
            "BACKEND": "django.core.mail.backends.smtp.EmailBackend",
            "OPTIONS": {
                "host": "smtp.gmail.com",
                "port": 587,
                "username": SUPPORT_EMAIL,
                "password": EMAIL_APP_PASSWORD,
                "use_tls": True,
                "timeout": 20,
            },
        },
    }
else:
    MAILERS = {
        "default": {
            "BACKEND": "django.core.mail.backends.console.EmailBackend",
        },
    }


# Slack
# Notifications are off unless SLACK_BOT_TOKEN is set. Channels can be a name
# (#announcements) or an ID; the bot must be invited to each one. The invite
# link is shown to signed-in users so they can join the workspace.

SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
SLACK_ANNOUNCEMENTS_CHANNEL = os.environ.get("SLACK_ANNOUNCEMENTS_CHANNEL", "")
SLACK_ALERTS_CHANNEL = os.environ.get("SLACK_ALERTS_CHANNEL", "") or SLACK_ANNOUNCEMENTS_CHANNEL
SLACK_INVITE_URL = os.environ.get("SLACK_INVITE_URL", "")
