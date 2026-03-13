#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
IMAGE_NAME="pm-mvp-app:latest"
CONTAINER_NAME="pm-mvp-app"

echo "Building Docker image: ${IMAGE_NAME}"
docker build -t "${IMAGE_NAME}" "${PROJECT_ROOT}"

if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
  echo "Removing existing container: ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

echo "Starting container: ${CONTAINER_NAME}"
ENV_FILE="${PROJECT_ROOT}/.env"
if [[ -f "${ENV_FILE}" ]]; then
  docker run -d --name "${CONTAINER_NAME}" --env-file "${ENV_FILE}" -p 8000:8000 "${IMAGE_NAME}" >/dev/null
else
  docker run -d --name "${CONTAINER_NAME}" -p 8000:8000 "${IMAGE_NAME}" >/dev/null
fi

echo "App started:"
echo "  http://127.0.0.1:8000/"
echo "  http://127.0.0.1:8000/api/hello"
