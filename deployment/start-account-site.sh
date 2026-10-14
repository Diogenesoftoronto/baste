#!/bin/sh
set -eu
node /app/deployment/account-api.mjs &
account_pid=$!
nginx -g 'daemon off;' &
nginx_pid=$!
stop() { kill -TERM "$account_pid" "$nginx_pid" 2>/dev/null || true; }
trap stop INT TERM EXIT
# If either process exits, stop both; Railway can restart the failed service.
while kill -0 "$account_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do sleep 1; done
exit 1
