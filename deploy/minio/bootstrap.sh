#!/bin/sh
set -eu

alias_name="delegate"
endpoint="${ARTIFACT_STORE_ENDPOINT:-http://artifact-store:9000}"
bucket="${ARTIFACT_STORE_BUCKET:-delegate-compute-artifacts}"
access_key="${ARTIFACT_STORE_ACCESS_KEY:-delegate}"
secret_key="${ARTIFACT_STORE_SECRET_KEY:-delegate-secret-key}"

echo "Waiting for MinIO at ${endpoint}..."
until mc alias set "${alias_name}" "${endpoint}" "${access_key}" "${secret_key}" >/dev/null 2>&1; do
  sleep 2
done

mc mb --ignore-existing "${alias_name}/${bucket}" >/dev/null
mc anonymous set none "${alias_name}/${bucket}" >/dev/null 2>&1 || true

echo "MinIO bucket ${bucket} is ready."
