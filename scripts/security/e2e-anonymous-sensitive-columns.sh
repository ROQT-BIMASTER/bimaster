#!/usr/bin/env bash
# E2E Security Test — Anonymous access to sensitive financial/competitive columns
#
# Purpose: Guarantee that, without authentication, any attempt to read sensitive
# columns (cost, margin_percentage and variants) on the affected tables returns
# either a PostgREST error (column does not exist / permission denied) OR an
# empty array. NEVER actual data rows.
#
# Tables under test:
#   - our_products            (cost, margin_percentage, price, ...)
#   - product_comparisons     (similarity_score, comparison_notes, ...)
#   - social_media_metrics_history (followers_count, engagement_rate, ...)
#
# Run:
#   bash scripts/security/e2e-anonymous-sensitive-columns.sh
#
# Exit codes: 0 = all blocked, 1 = at least one leak detected.

set -u

SUPABASE_URL="${SUPABASE_URL:?defina SUPABASE_URL antes de rodar}"
ANON_KEY="${SUPABASE_ANON_KEY:?defina SUPABASE_ANON_KEY antes de rodar}"

PASS=0
FAIL=0
LEAKS=()

# Sensitive column variants to probe (covers EN/PT and common synonyms)
OUR_PRODUCTS_COLS=(
  "cost" "custo" "cost_price" "unit_cost"
  "margin_percentage" "margin" "margem" "margem_percentual" "profit_margin"
  "price" "preco" "sale_price" "wholesale_price"
)

PRODUCT_COMPARISONS_COLS=(
  "similarity_score" "comparison_notes" "competitor_price"
  "price_difference" "our_price" "their_price" "notes"
)

SOCIAL_METRICS_COLS=(
  "followers_count" "followers" "engagement_rate" "engagement"
  "sentiment_score" "username" "reach" "impressions"
)

# assert_blocked NAME URL
# Pass if response is: PostgREST error object OR empty JSON array.
# Fail if response is a non-empty array (data leak).
assert_blocked() {
  local name="$1"
  local url="$2"
  local body
  body=$(curl -s --max-time 10 -H "apikey: $ANON_KEY" "$url")
  local first
  first=$(printf '%s' "$body" | head -c 1)

  if [ "$first" = "{" ]; then
    # PostgREST error JSON — no data leaked
    PASS=$((PASS + 1))
    printf "  PASS  %s -> error response (no data)\n" "$name"
    return 0
  fi

  if [ "$first" = "[" ]; then
    local count
    count=$(printf '%s' "$body" | python3 -c "import sys,json
try:
  d=json.loads(sys.stdin.read() or '[]')
  print(len(d) if isinstance(d,list) else -1)
except Exception:
  print(-2)" 2>/dev/null)
    if [ "$count" = "0" ]; then
      PASS=$((PASS + 1))
      printf "  PASS  %s -> 0 rows\n" "$name"
      return 0
    fi
    FAIL=$((FAIL + 1))
    LEAKS+=("$name -> $count rows | $(printf '%s' "$body" | head -c 200)")
    printf "  FAIL  %s -> %s rows LEAKED\n" "$name" "$count"
    return 1
  fi

  # Unknown response shape — treat as failure for safety
  FAIL=$((FAIL + 1))
  LEAKS+=("$name -> unexpected response | $(printf '%s' "$body" | head -c 200)")
  printf "  FAIL  %s -> unexpected response\n" "$name"
  return 1
}

# count_probe TABLE
# Uses Prefer: count=exact + Range: 0-0 to assert PostgREST returns */0.
count_probe() {
  local tbl="$1"
  local hdr
  hdr=$(curl -s --max-time 10 -I \
    -H "apikey: $ANON_KEY" \
    -H "Prefer: count=exact" \
    -H "Range: 0-0" \
    "$SUPABASE_URL/rest/v1/$tbl?select=id" \
    | grep -i "content-range" | tr -d '\r')

  if printf '%s' "$hdr" | grep -qiE 'content-range:\s*\*/0'; then
    PASS=$((PASS + 1))
    printf "  PASS  count(%s) -> %s\n" "$tbl" "$hdr"
  else
    FAIL=$((FAIL + 1))
    LEAKS+=("count($tbl) -> $hdr")
    printf "  FAIL  count(%s) -> %s\n" "$tbl" "$hdr"
  fi
}

probe_table() {
  local tbl="$1"
  shift
  local cols=("$@")

  echo
  echo "[$tbl]"

  # 1) full row select
  assert_blocked "$tbl ?select=*" \
    "$SUPABASE_URL/rest/v1/$tbl?select=*&limit=10"

  # 2) id only
  assert_blocked "$tbl ?select=id" \
    "$SUPABASE_URL/rest/v1/$tbl?select=id&limit=10"

  # 3) each sensitive column individually
  for c in "${cols[@]}"; do
    assert_blocked "$tbl ?select=$c" \
      "$SUPABASE_URL/rest/v1/$tbl?select=$c&limit=10"
  done

  # 4) all sensitive cols joined
  local joined
  joined=$(IFS=,; echo "${cols[*]}")
  assert_blocked "$tbl ?select=$joined (combined)" \
    "$SUPABASE_URL/rest/v1/$tbl?select=$joined&limit=10"

  # 5) ordering by sensitive col (forces server-side touch)
  for c in "${cols[@]}"; do
    assert_blocked "$tbl ?order=$c.desc" \
      "$SUPABASE_URL/rest/v1/$tbl?select=id&order=$c.desc&limit=5"
  done

  # 6) filtering by sensitive col
  for c in "${cols[@]}"; do
    assert_blocked "$tbl ?$c=gt.0" \
      "$SUPABASE_URL/rest/v1/$tbl?select=id&$c=gt.0&limit=5"
  done

  # 7) HEAD count probe
  count_probe "$tbl"
}

echo "=========================================================="
echo " E2E: Anonymous access to sensitive columns must be blocked"
echo " URL: $SUPABASE_URL"
echo "=========================================================="

probe_table "our_products"             "${OUR_PRODUCTS_COLS[@]}"
probe_table "product_comparisons"      "${PRODUCT_COMPARISONS_COLS[@]}"
probe_table "social_media_metrics_history" "${SOCIAL_METRICS_COLS[@]}"

echo
echo "=========================================================="
echo " RESULT: $PASS passed, $FAIL failed"
echo "=========================================================="

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "DATA LEAKS DETECTED:"
  for leak in "${LEAKS[@]}"; do
    echo "  - $leak"
  done
  exit 1
fi

echo "OK: All sensitive columns are inaccessible without authentication."
exit 0
