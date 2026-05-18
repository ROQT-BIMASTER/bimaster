#!/usr/bin/env bash
# scripts/recovery/backup-pre-restore.sh
# Snapshot completo PRÉ-RESTORE: dump JSON + download de todos arquivos.
# Saída: /mnt/documents/backup-pre-restore-<timestamp>/
set -uo pipefail

urlencode() { python3 -c "import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe='/'))" "$1"; }

TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="/mnt/documents/backup-pre-restore-${TS}"
mkdir -p "$OUT/tables" "$OUT/storage"

PROJECT_REF="${SUPABASE_PROJECT_ID:?}"
SUPABASE_URL="${SUPABASE_URL:?}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?}"

echo "[1/3] Dumping tabelas china_* e fabrica_* para JSON..."

TABLES=$(psql -t -A -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE 'china_%' OR table_name LIKE 'fabrica_%') ORDER BY table_name;")

: > "$OUT/tables/_manifest.tsv"
echo -e "table\trows\tbytes" >> "$OUT/tables/_manifest.tsv"

for T in $TABLES; do
  CNT=$(psql -t -A -c "SELECT count(*) FROM public.\"$T\";" 2>/dev/null || echo 0)
  FILE="$OUT/tables/${T}.json"
  psql -t -A -c "COPY (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.\"$T\" r) TO STDOUT;" > "$FILE" 2>/dev/null || echo "[]" > "$FILE"
  SIZE=$(stat -c%s "$FILE")
  echo -e "${T}\t${CNT}\t${SIZE}" >> "$OUT/tables/_manifest.tsv"
  printf "  %-50s %6s rows  %8s bytes\n" "$T" "$CNT" "$SIZE"
done

echo "[2/3] Baixando arquivos dos buckets críticos..."

BUCKETS=(
  china-documentos
  china-chat-anexos
  china-copilot-pdf
  china-pasta-digital
  pasta-digital
  fabrica-produto-fotos
  fabrica-nfe-xmls
  fabrica-revisao-docs
  fabrica-custo-evidencias
  fabrica-cotacoes
)

BACKUP_TOKEN="88773abe3ea871051e7ee6ce3717c9bfbac2881409a45849760e8d416e73d7e0"
SIGN_URL="${SUPABASE_URL}/functions/v1/backup-signed-urls"
APIKEY="${VITE_SUPABASE_ANON_KEY:-$SUPABASE_PUBLISHABLE_KEY}"

: > "$OUT/storage/_manifest.tsv"
echo -e "bucket\tpath\tbytes\tsha256\tstatus" >> "$OUT/storage/_manifest.tsv"

for B in "${BUCKETS[@]}"; do
  echo "  bucket: $B"
  mkdir -p "$OUT/storage/$B"
  PATHS=$(psql -t -A -c "SELECT name FROM storage.objects WHERE bucket_id='$B' ORDER BY name;")
  if [ -z "$PATHS" ]; then
    echo "    (vazio)"
    continue
  fi

  # Monta payload JSON em lotes de 200
  echo "$PATHS" | python3 -c "
import sys, json
paths = [l.strip() for l in sys.stdin if l.strip()]
batch = 200
for i in range(0, len(paths), batch):
    items = [{'bucket': '$B', 'path': p} for p in paths[i:i+batch]]
    print(json.dumps({'items': items}))
" | while IFS= read -r PAYLOAD; do
    RESP=$(curl -sS -X POST \
      -H "Content-Type: application/json" \
      -H "apikey: $APIKEY" \
      -H "x-backup-token: $BACKUP_TOKEN" \
      -d "$PAYLOAD" \
      "$SIGN_URL")

    echo "$RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('results', []):
    print('\t'.join([r['bucket'], r['path'], r.get('url',''), r.get('error','')]))
" | while IFS=$'\t' read -r BK PT URL ERR; do
      [ -z "$PT" ] && continue
      SAFE=$(echo "$PT" | tr '/' '__')
      DEST="$OUT/storage/$BK/$SAFE"
      if [ -z "$URL" ]; then
        echo "    FAIL($ERR) $PT"
        echo -e "${BK}\t${PT}\t-\t-\tFAIL:${ERR}" >> "$OUT/storage/_manifest.tsv"
        continue
      fi
      HTTP=$(curl -sS -L -o "$DEST" -w '%{http_code}' "$URL" 2>/dev/null || echo "000")
      if [ "$HTTP" != "200" ]; then
        echo "    DL_FAIL($HTTP) $PT"
        rm -f "$DEST"
        echo -e "${BK}\t${PT}\t-\t-\tHTTP_${HTTP}" >> "$OUT/storage/_manifest.tsv"
        continue
      fi
      SHA=$(sha256sum "$DEST" | cut -d' ' -f1)
      RSIZE=$(stat -c%s "$DEST")
      echo -e "${BK}\t${PT}\t${RSIZE}\t${SHA}\tOK" >> "$OUT/storage/_manifest.tsv"
    done
  done
  COUNT=$(grep -c -P "^${B}\t.*\tOK$" "$OUT/storage/_manifest.tsv" || echo 0)
  echo "    baixados: $COUNT"
done

echo "[3/3] Gerando manifest geral e zipando..."

cat > "$OUT/README.md" <<EOF
# Backup pré-restore — ${TS}

Snapshot tirado em $(date -u +"%Y-%m-%d %H:%M:%S UTC") (antes do PITR/restore solicitado ao suporte).

## Conteúdo

- \`tables/\` — dump JSON de todas as tabelas \`china_*\` e \`fabrica_*\`.
  Ver \`tables/_manifest.tsv\` para contagens.
- \`storage/<bucket>/\` — todos os arquivos dos buckets críticos.
  Nomes originais com \`/\` substituído por \`__\`.
  Ver \`storage/_manifest.tsv\` para path original + sha256.

## Reimport pós-restore

1. Comparar contagens (\`tables/_manifest.tsv\` vs estado restaurado).
2. Para cada tabela com mais linhas no backup que no restore, fazer
   \`INSERT ... ON CONFLICT (id) DO NOTHING\` linha a linha a partir do JSON.
3. Para storage, reupload via API com mesmo path (coluna \`path\` do manifest).
EOF

cd /mnt/documents && zip -qr "backup-pre-restore-${TS}.zip" "backup-pre-restore-${TS}"
SZ=$(du -h "/mnt/documents/backup-pre-restore-${TS}.zip" | cut -f1)
echo "OK: /mnt/documents/backup-pre-restore-${TS}.zip ($SZ)"
