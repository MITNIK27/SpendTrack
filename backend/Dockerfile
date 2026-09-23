FROM python:3.11-slim

WORKDIR /app

# psycopg[binary] ships prebuilt wheels, so no build-essential/libpq-dev needed.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Local attachment storage until Phase 12 (Firebase Storage) lands — mount a volume here in prod.
RUN mkdir -p uploads

EXPOSE 8005

ENTRYPOINT ["./docker-entrypoint.sh"]
