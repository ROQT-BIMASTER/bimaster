#!/usr/bin/env bash
# Retoma o snapshot pré-restore: pula tabelas/arquivos já baixados, exclui módulo financeiro.
set -uo pipefail

OUT="${1:-/mnt/documents/backup-full-20260518T161838Z}"
mkdir -p "$OUT/tables" "$OUT/storage"

SUPABASE_URL="${SUPABASE_URL:?}"
APIKEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_PUBLISHABLE_KEY:-}}"
BACKUP_TOKEN="88773abe3ea871051e7ee6ce3717c9bfbac2881409a45849760e8d416e73d7e0"
SIGN_URL="${SUPABASE_URL}/functions/v1/backup-signed-urls"

# ----- exclusões: módulo financeiro -----
SKIP_TABLES_RE='^(conciliacao_uploads|contas_bancarias|contas_pagar.*|contas_receber|finalidades_transferencia|financial_.*|plano_contas.*|pluggy_.*|boletos|lancamentos_conta_corrente|pagamentos|recebimentos|ap_data_source_config)$'
SKIP_BUCKETS_RE='^(comprovantes|payment-chat-files)$'

MANIFEST_T="$OUT/tables/_manifest.tsv"
MANIFEST_S="$OUT/storage/_manifest.tsv"
[ -f "$MANIFEST_T" ] || echo -e "table\trows\tbytes\tstatus" > "$MANIFEST_T"
[ -f "$MANIFEST_S" ] || echo -e "bucket\tpath\tbytes\tsha256\tstatus" > "$MANIFEST_S"

echo "[1/2] Tabelas (pulando já dumpadas e financeiro)..."
TABLES=$(psql -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")
T_TOTAL=0; T_SKIP=0; T_DONE=0; T_NEW=0
for T in $TABLES; do
  T_TOTAL=$((T_TOTAL+1))
  if [[ "$T" =~ $SKIP_TABLES_RE ]]; then T_SKIP=$((T_SKIP+1)); continue; fi
  FILE="$OUT/tables/${T}.json"
  if [ -s "$FILE" ]; then T_DONE=$((T_DONE+1)); continue; fi
  CNT=$(psql -t -A -c "SELECT count(*) FROM public.\"$T\";" 2>/dev/null || echo "?")
  if psql -t -A -c "COPY (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.\"$T\" r) TO STDOUT;" > "$FILE" 2>/dev/null; then
    SIZE=$(stat -c%s "$FILE")
    echo -e "${T}\t${CNT}\t${SIZE}\tOK" >> "$MANIFEST_T"
  else
    echo "[]" > "$FILE"
    echo -e "${T}\t${CNT}\t0\tFAIL" >> "$MANIFEST_T"
  fi
  T_NEW=$((T_NEW+1))
done
echo "  total=$T_TOTAL skip_fin=$T_SKIP ja_dumpadas=$T_DONE novas=$T_NEW"

echo "[2/2] Buckets (resumindo, pulando financeiro)..."
BUCKETS=$(psql -t -A -c "SELECT id FROM storage.buckets ORDER BY id;")
for B in $BUCKETS; do
  if [[ "$B" =~ $SKIP_BUCKETS_RE ]]; then echo "  skip(fin): $B"; continue; fi
  BCOUNT=$(psql -t -A -c "SELECT count(*) FROM storage.objects WHERE bucket_id='$B';" 2>/dev/null || echo 0)
  [ "$BCOUNT" = "0" ] && continue
  mkdir -p "$OUT/storage/$B"
  # paths já presentes (não-vazios) -> set
  DONE_FILE="$OUT/storage/$B/.done"
  : > "$DONE_FILE.new"
  find "$OUT/storage/$B" -maxdepth 1 -type f ! -name '.*' -size +0c -printf '%f\n' \
    | sed 's|__|/|g' | sort -u > "$DONE_FILE" 2>/dev/null || true
  ALREADY=$(wc -l < "$DONE_FILE" 2>/dev/null || echo 0)
  echo "  bucket: $B  já=$ALREADY / total=$BCOUNT"
  [ "$ALREADY" -ge "$BCOUNT" ] && { echo "    completo"; continue; }

  ALL_PATHS=$(psql -t -A -c "SELECT name FROM storage.objects WHERE bucket_id='$B' ORDER BY name;")
  # filtra paths não baixados
  PENDING=$(comm -23 <(echo "$ALL_PATHS" | sort -u) <(sort -u "$DONE_FILE"))
  PEND_N=$(echo "$PENDING" | grep -c . || true)
  echo "    pendentes=$PEND_N"
  [ "$PEND_N" = "0" ] && continue

  echo "$PENDING" | python3 -c "
import sys, json
paths=[l.strip() for l in sys.stdin if l.strip()]
B='$B'
for i in range(0,len(paths),200):
    print(json.dumps({'items':[{'bucket':B,'path':p} for p in paths[i:i+200]]}))
" | while IFS= read -r PAYLOAD; do
    RESP=$(curl -sS -X POST -H "Content-Type: application/json" \
      -H "apikey: $APIKEY" -H "x-backup-token: $BACKUP_TOKEN" \
      -d "$PAYLOAD" "$SIGN_URL")
    echo "$RESP" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
except Exception as e:
  sys.stderr.write('parse_err\n'); sys.exit(0)
for r in d.get('results',[]):
    print('\t'.join([r['bucket'],r['path'],r.get('url',''),r.get('error','')]))
" | while IFS=$'\t' read -r BK PT URL ERR; do
      [ -z "$PT" ] && continue
      SAFE=$(echo "$PT" | tr '/' '__')
      DEST="$OUT/storage/$BK/$SAFE"
      [ -s "$DEST" ] && continue
      if [ -z "$URL" ]; then
        echo -e "${BK}\t${PT}\t-\t-\tSIGN_FAIL:${ERR}" >> "$MANIFEST_S"; continue
      fi
      HTTP=$(curl -sS -L -o "$DEST" -w '%{http_code}' --max-time 300 "$URL" 2>/dev/null || echo "000")
      if [ "$HTTP" != "200" ]; then
        rm -f "$DEST"
        echo -e "${BK}\t${PT}\t-\t-\tHTTP_${HTTP}" >> "$MANIFEST_S"; continue
      fi
      SHA=$(sha256sum "$DEST" | cut -d' ' -f1)
      RSIZE=$(stat -c%s "$DEST")
      echo -e "${BK}\t${PT}\t${RSIZE}\t${SHA}\tOK" >> "$MANIFEST_S"
    done
  done
  DONE=$(find "$OUT/storage/$B" -maxdepth 1 -type f ! -name '.*' -size +0c | wc -l)
  echo "    ok agora: $DONE / $BCOUNT"
done

echo "OK. Diretório: $OUT"
du -sh "$OUT"
