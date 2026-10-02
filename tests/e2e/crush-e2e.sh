#!/usr/bin/env bash
#
# End-to-end test for the Baste Studio API, with crush as the verdict engine.
#
# Design: the harness boots the real GUI/API server (`baste gui`), waits for
# health, then performs a fixed set of live HTTP calls and records each
# request/response pair. The recorded transcript is piped to `crush run`, which
# evaluates the whole end-to-end run against the stated expectations and emits a
# structured PASS/FAIL verdict. crush does the *testing* (judgement over the live
# stack); the deterministic harness makes the calls, so no autonomous shell loop
# or disabled approval gates are involved.
#
# Usage:  tests/e2e/crush-e2e.sh [port]
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
PORT="${1:-3456}"
BASE="http://localhost:${PORT}"
LOG="$(mktemp -t baste-gui-XXXX.log)"
TRANSCRIPT="$(mktemp -t baste-e2e-XXXX.txt)"
OUT="$(mktemp -t baste-e2e-XXXX.out)"

cleanup() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null
  wait "${SERVER_PID:-}" 2>/dev/null
}
trap cleanup EXIT

echo "▶ building…"
npm run build >/dev/null 2>&1 || { echo "✖ build failed"; exit 1; }

echo "▶ starting server on :$PORT…"
node dist/src/cli.js gui --port "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!

ready=
for _ in $(seq 1 40); do
  if curl -sf "$BASE/api/health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.5
done
if [ -z "$ready" ]; then
  echo "✖ server never became healthy. Log:"; cat "$LOG"; exit 1
fi
echo "✔ server healthy"

# ── Record one request/response pair into the transcript ──────────────────────
# Args: <check#> <expectation> <METHOD> <path> [json-body]
record() {
  local n="$1" expect="$2" method="$3" path="$4" body="${5:-}"
  local code resp
  if [ "$method" = "GET" ]; then
    resp="$(curl -s -w $'\n__HTTP__%{http_code}' "$BASE$path")"
  else
    resp="$(curl -s -w $'\n__HTTP__%{http_code}' -X "$method" -H 'Content-Type: application/json' -d "$body" "$BASE$path")"
  fi
  code="${resp##*__HTTP__}"
  resp="${resp%$'\n'__HTTP__*}"
  {
    echo "### CHECK $n"
    echo "EXPECT: $expect"
    echo "REQUEST: $method $path ${body:+body=$body}"
    echo "HTTP_STATUS: $code"
    echo "BODY (first 600 chars):"
    echo "${resp:0:600}"
    echo
  } >> "$TRANSCRIPT"
}

echo "▶ recording live request/response pairs…"
: > "$TRANSCRIPT"
record 1 'HTTP 200 and JSON body has "status":"ok"' GET  /api/health
record 2 'HTTP 200 and JSON array includes an item with id "cyberbotanist"' GET /api/personas
record 3 'HTTP 200 and JSON object with id "cyberbotanist"' GET /api/personas/cyberbotanist
record 4 'HTTP 200 with a JSON body' GET /api/config
record 5 'HTTP 200 and "content" includes ":root" (CSS export)' POST /api/tokens/cyberbotanist '{"format":"css"}'
record 6 'HTTP 200 and "content" is a JSON string of design tokens' POST /api/tokens/cyberbotanist '{"format":"json"}'
record 7 'HTTP 200 and a non-empty "image" prompt field' POST /api/prompts/cyberbotanist '{}'
record 8 'HTTP 404 — unknown persona must not resolve (negative test)' GET /api/personas/does-not-exist-xyz

PROMPT="You are evaluating an end-to-end API test run for the Baste Studio server.
Below is a transcript of live HTTP request/response pairs, each with the
expectation it must satisfy. For EACH check, decide PASS or FAIL strictly against
its EXPECT line and the recorded HTTP_STATUS + BODY. Print one line per check as
'CHECK n: PASS|FAIL — <short reason>'. Then print exactly one final line:
'E2E_RESULT: PASS' only if every check passed, otherwise 'E2E_RESULT: FAIL'.

TRANSCRIPT:
$(cat "$TRANSCRIPT")"

echo "▶ asking crush to evaluate the run…"
printf '%s' "$PROMPT" | crush run --quiet 2>&1 | tee "$OUT"

echo "──────────────────────────────────────────"
if grep -q "E2E_RESULT: PASS" "$OUT"; then
  echo "✔ E2E PASSED (per crush verdict)"
  exit 0
else
  echo "✖ E2E FAILED (see crush verdict above)"
  exit 1
fi
