FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend ./
RUN npm run build

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY backend /app/backend
RUN uv pip install --system \
    "fastapi>=0.116.1" \
    "uvicorn>=0.35.0" \
    "pytest>=8.4.2" \
    "httpx>=0.28.1"

COPY --from=frontend-builder /app/frontend/out /app/frontend/out

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
