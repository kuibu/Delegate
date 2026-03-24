#!/bin/sh
set -eu

python /opt/delegate-openviking/render-config.py

OPENVIKING_SERVER_BIN="${OPENVIKING_SERVER_BIN:-/app/.venv/bin/openviking-server}"
OPENVIKING_CONFIG_FILE="${OPENVIKING_CONFIG_FILE:-/etc/openviking/ov.conf}"

if [ ! -x "$OPENVIKING_SERVER_BIN" ]; then
  echo "OpenViking server binary not found at $OPENVIKING_SERVER_BIN" >&2
  exit 127
fi

exec "$OPENVIKING_SERVER_BIN" --config "$OPENVIKING_CONFIG_FILE"
