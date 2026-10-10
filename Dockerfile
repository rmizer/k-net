# K-Net production image: Django serves the API, the admin and the built React app.

# 1. Build the React app.
FROM node:22.15-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. The Django app, with the built frontend copied in.
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FRONTEND_DIST=/app/frontend/dist
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist
# The real secret key is only needed at run time.
RUN DJANGO_SECRET_KEY=build-only python manage.py collectstatic --noinput

# Apply database changes, then start the web server on the port Railway gives us.
CMD python manage.py migrate --noinput && \
    gunicorn config.wsgi --bind 0.0.0.0:${PORT:-8000} --workers 3 --timeout 60 --access-logfile -
