#!/usr/bin/env bash
set -euo pipefail

REGISTRY="us-east4-docker.pkg.dev"
REPO="${OPENCOST_UI_REPO:-${REGISTRY}/sandbox-dhwjqy/opencost-ui}"
TAG="${OPENCOST_UI_TAG:-$(git rev-parse --short HEAD)}"
IMAGE="${REPO}/opencost-ui:${TAG}"

# Write auth config directly — nerdctl login breaks with credsStore in ~/.docker/config.json
export DOCKER_CONFIG="$(mktemp -d)"
trap 'rm -rf "${DOCKER_CONFIG}"' EXIT

echo "==> Authenticating to Artifact Registry..."
TOKEN=$(gcloud auth print-access-token)
AUTH=$(printf 'oauth2accesstoken:%s' "${TOKEN}" | base64 | tr -d '\n')
printf '{"auths":{"%s":{"auth":"%s"}}}' "${REGISTRY}" "${AUTH}" > "${DOCKER_CONFIG}/config.json"

echo "==> Building opencost-ui image: ${IMAGE}"
nerdctl build \
  --platform linux/amd64 \
  --build-arg version="${TAG}" \
  --build-arg commit="$(git rev-parse --short HEAD)" \
  -t "${IMAGE}" \
  .

echo "==> Pushing ${IMAGE}..."
nerdctl push "${IMAGE}"

echo ""
echo "OPENCOST_UI_IMAGE=${IMAGE}"
