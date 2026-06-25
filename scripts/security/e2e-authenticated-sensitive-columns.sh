#!/usr/bin/env bash
# E2E Security Test — Authenticated access MUST work for sensitive tables
#
# Counterpart of e2e-anonymous-sensitive-columns.sh.
# Goal: prove that the RLS lockdown only affects anonymous users, and that
# authenticated users still receive valid responses (200 OK + JSON array)
# from the same endpoints — i.e. we did not break legitimate access while
# closing public exposure.
#
# Required env vars (CI):
#   E2E_TEST_EMAIL     - email of a seeded test user (any role)
#   E2E_TEST_PASSWORD  - that user's password
#
# Optional:
#   SUPABASE_URL       - defaults to project URL
#   SUPABASE_ANON_KEY  - defaults to project anon key
#
# Pass criteria per probe:
#   * HTTP 200 with a JSON array (length >= 0) -> PASS (auth works, RLS evaluated)
#   * HTTP 200 with empty array                 -> PASS (auth works, no rows match - acceptable)
#   * HTTP 401/403                              -> FAIL (auth wrongly rejected)
#   * Network/parse error                       -> FAIL
#
# Note: an empty array for an authenticated user is acceptable - it means RLS
# is correctly scoping data per user. What we are validating here is that the
# request is ACCEPTED (no 401/403), which proves the lockdown is anon-only.

set -u

SUPABASE_URL="${SUPABASE_URL:?defina SUPABASE_URL antes de rodar}"
ANON_KEY="${SUPABASE_ANON_KEY:?defina SUPABASE_ANON_KEY antes de rodar}"

if [ -z "${E2E_TEST_EMAIL:-}" ] || [ -z "${E2E_TEST_PASSWORD:-}" ]; then
  echo "SKIP: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set."
  echo "      In CI, set these as GitHub Secrets to enable the authenticated probe."
  exit 0
fi

echo "=========================================================="
echo " E2E: Authenticated access MUST succeed on sensitive tables"
echo " URL: $SUPABASE_URL"
echo " User: $E2E_TEST_EMAIL"
echo "=========================================================="

# 1) Sign in via GoTrue
TOKEN_RESP=$(curl -s --max-time 15 \
  -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,os;print(json.dumps({'email':os.environ['E2E_TEST_EMAIL'],'password':os.environ['E2E_TEST_PASSWORD']}))")")

ACCESS_TOKEN=$(printf '%s' "$TOKEN_RESP" | python3 -c "import sys,json
try:
  d=json.loads(sys.stdin.read())
  print(d.get('access_token',''))
except Exception:
  print('')")

if [ -z "$ACCESS_TOKEN" ]; then
  echo "FAIL: could not obtain access_token. Response:"
  printf '%s\n' "$TOKEN_RESP" | head -c 500
  echo
  exit 1
fi

echo "Authenticated OK (token length: ${#ACCESS_TOKEN})"
echo

PASS=0
FAIL=0
FAILURES=()

# Real columns present in the schema (probed via information_schema).
# These are the "sensitive equivalents" actually stored today.
PROBES=(
  "our_products|select=*"
  "our_products|select=id,name,sku,category"

  "product_comparisons|select=*"
  "product_comparisons|select=similarity_score,comparison_notes"
  "product_comparisons|select=our_product_id,competitor_product_id,similarity_score"

  "social_media_metrics_history|select=*"
  "social_media_metrics_history|select=username,followers,engagement,reach"
  "social_media_metrics_history|select=likes,comments,shares,sentiment_score"
)

assert_authenticated_ok() {
  local name="$1" url="$2"
  # capture body + http code
  local resp
  resp=$(curl -s --max-time 15 -w "\n__HTTP__:%{http_code}" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$url")
  local code
  code=$(printf '%s' "$resp" | grep -oE '__HTTP__:[0-9]+$' | sed 's/__HTTP__://')
  local body
  body=$(printf '%s' "$resp" | sed 's/__HTTP__:[0-9]*$//')

  if [ "$code" = "200" ]; then
    local first
    first=$(printf '%s' "$body" | head -c 1)
    if [ "$first" = "[" ]; then
      local count
      count=$(printf '%s' "$body" | python3 -c "import sys,json
try:
  d=json.loads(sys.stdin.read() or '[]')
  print(len(d) if isinstance(d,list) else -1)
except Exception:
  print(-2)" 2>/dev/null)
      PASS=$((PASS + 1))
      printf "  PASS  [%s] -> 200, %s row(s)\n" "$name" "$count"
      return 0
    fi
  fi

  FAIL=$((FAIL + 1))
  FAILURES+=("$name -> HTTP $code | $(printf '%s' "$body" | head -c 200)")
  printf "  FAIL  [%s] -> HTTP %s\n" "$name" "$code"
  return 1
}

for p in "${PROBES[@]}"; do
  tbl="${p%%|*}"
  qs="${p##*|}"
  assert_authenticated_ok "$tbl ?$qs" "$SUPABASE_URL/rest/v1/$tbl?$qs&limit=5"
done

# Sanity: same endpoints with anon-only headers MUST still return empty / error.
echo
echo "[Sanity] same endpoints without Authorization should remain blocked"
ANON_LEAK=0
for p in "${PROBES[@]}"; do
  tbl="${p%%|*}"
  qs="${p##*|}"
  body=$(curl -s --max-time 10 -H "apikey: $ANON_KEY" "$SUPABASE_URL/rest/v1/$tbl?$qs&limit=5")
  first=$(printf '%s' "$body" | head -c 1)
  if [ "$first" = "[" ]; then
    count=$(printf '%s' "$body" | python3 -c "import sys,json;print(len(json.loads(sys.stdin.read() or '[]')))" 2>/dev/null)
    if [ "$count" != "0" ]; then
      ANON_LEAK=$((ANON_LEAK + 1))
      printf "  LEAK  anon got %s rows on %s ?%s\n" "$count" "$tbl" "$qs"
    fi
  fi
done
if [ "$ANON_LEAK" -eq 0 ]; then
  PASS=$((PASS + 1))
  echo "  PASS  anon remains blocked on all probed endpoints"
else
  FAIL=$((FAIL + 1))
  FAILURES+=("anon leaked on $ANON_LEAK endpoint(s)")
fi

echo
echo "=========================================================="
echo " RESULT: $PASS passed, $FAIL failed"
echo "=========================================================="

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "FAILURES:"
  for f in "${FAILURES[@]}"; do
    echo "  - $f"
  done
  exit 1
fi

echo "OK: Authenticated user reads sensitive tables; anonymous remains blocked."
exit 0
