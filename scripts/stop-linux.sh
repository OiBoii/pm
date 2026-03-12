#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="pm-mvp-app"

if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
  docker rm -f "${CONTAINER_NAME}" >/dev/null
  echo "Stopped and removed container: ${CONTAINER_NAME}"
else
  echo "No container found named ${CONTAINER_NAME}"
fi
