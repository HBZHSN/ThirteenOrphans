FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=9000 \
    GUNICORN_WORKERS=1 \
    GUNICORN_THREADS=4 \
    GUNICORN_TIMEOUT=120

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --home-dir /app app

COPY requirements.txt .
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY static ./static
COPY img ./img

RUN mkdir -p records && chown -R app:app /app

USER app

EXPOSE 9000

CMD ["sh", "-c", "gunicorn --workers ${GUNICORN_WORKERS:-1} --threads ${GUNICORN_THREADS:-4} --bind 0.0.0.0:${PORT:-9000} --access-logfile - --error-logfile - --timeout ${GUNICORN_TIMEOUT:-120} app:app"]
