#!/bin/sh
set -eu
base=${BASE_URL:-http://localhost:8080}
curl -fsS "$base/" >/dev/null
curl -fsS "$base/api/health" >/dev/null
code=$(curl -s -o /dev/null -w '%{http_code}' "$base/api/products")
[ "$code" = 401 ] || { echo "Expected protected API 401, got $code" >&2; exit 1; }
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d '{}')
[ "$code" = 422 ] || { echo "Login endpoint unavailable ($code)" >&2; exit 1; }
curl -fsS "$base/dashboard" >/dev/null
echo "Production smoke test passed."
