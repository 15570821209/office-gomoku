FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=10000

WORKDIR /app
COPY . .

RUN useradd --create-home appuser
USER appuser

EXPOSE 10000
CMD ["python", "server.py"]
