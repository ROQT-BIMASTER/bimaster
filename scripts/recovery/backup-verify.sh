#!/usr/bin/env bash
# scripts/recovery/backup-verify.sh
# Verificação de integridade do snapshot pré-restore.
# Compara manifesto contra estado atual do banco/storage e valida arquivos no disco
# (existência, tamanho, SHA-256). Saída: relatório TSV + sumário no stdout.
#
# Uso: bash scripts/recovery/backup-verify.sh [DIR_BACKUP]
#   DIR_BACKUP default: /mnt/documents/backup-full-20260518T161838Z
set -uo pipefail

OUT="${1:-/mnt/documents/backup-full-20260518T161838Z}"
[ -d "$OUT" ] || { echo "ERRO: diretório não existe: $OUT"; exit 1; }

MANIFEST_T="$OUT/tables/_manifest.tsv"
MANIFEST_S="$OUT/storage/_manifest.tsv"
REPORT="$OUT/_verify-report.tsv"
SUMMARY="$OUT/_verify-summary.md"

SKIP_TABLES_RE='^(conciliacao_uploads|contas_bancarias|contas_pagar.*|contas_receber|finalidades_transferencia|financial_.*|plano_contas.*|pluggy_.*|boletos|lancamentos_conta_corrente|pagamentos|recebimentos|ap_data_source_config)$'
SKIP_BUCKETS_RE='^(comprovantes|payment-chat-files)$'

echo "kind	id	expected	got	status" > "$REPORT"

# ---------- 1) TABELAS ----------
echo "[1/3] Verificando tabelas..."
T_TOTAL=0; T_OK=0; T_DIFF=0; T_MISS=0; T_SKIP=0; T_EMPTY_FILE=0
ALL_TABLES=$(psql -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")

for T in $ALL_TABLES; do
  T_TOTAL=$((T_TOTAL+1))
  if [[ "$T" =~ $SKIP_TABLES_RE ]]; then
    T_SKIP=$((T_SKIP+1))
    echo -e "table\t${T}\t-\t-\tSKIP_FIN" >> "$REPORT"
    continue
  fi
  FILE="$OUT/tables/${T}.json"
  CUR=$(psql -t -A -c "SELECT count(*) FROM public.\"$T\";" 2>/dev/null || echo "?")
  if [ ! -f "$FILE" ]; then
    T_MISS=$((T_MISS+1))
    echo -e "table\t${T}\t${CUR}\tMISSING\tMISSING_FILE" >> "$REPORT"
    continue
  fi
  # conta itens no JSON dump
  GOT=$(python3 -c "
import json,sys
try:
  d=json.load(open('$FILE'))
  print(len(d) if isinstance(d,list) else 0)
except Exception:
  print('PARSE_ERR')
" 2>/dev/null)
  if [ "$GOT" = "PARSE_ERR" ]; then
    T_EMPTY_FILE=$((T_EMPTY_FILE+1))
    echo -e "table\t${T}\t${CUR}\t-\tPARSE_ERR" >> "$REPORT"
    continue
  fi
  if [ "$CUR" = "$GOT" ]; then
    T_OK=$((T_OK+1))
    echo -e "table\t${T}\t${CUR}\t${GOT}\tOK" >> "$REPORT"
  else
    T_DIFF=$((T_DIFF+1))
    echo -e "table\t${T}\t${CUR}\t${GOT}\tDIFF" >> "$REPORT"
  fi
done

# ---------- 2) STORAGE ----------
echo "[2/3] Verificando storage (existência + tamanho + sha256)..."
S_TOTAL=0; S_OK=0; S_DIFF=0; S_MISS=0; S_SHA_FAIL=0; S_SKIP=0
declare -A BUCKET_EXPECTED BUCKET_GOT

BUCKETS=$(psql -t -A -c "SELECT id FROM storage.buckets ORDER BY id;")
for B in $BUCKETS; do
  if [[ "$B" =~ $SKIP_BUCKETS_RE ]]; then
    S_SKIP=$((S_SKIP+1))
    echo -e "bucket\t${B}\t-\t-\tSKIP_FIN" >> "$REPORT"
    continue
  fi
  EXPECTED=$(psql -t -A -c "SELECT count(*) FROM storage.objects WHERE bucket_id='$B';" 2>/dev/null || echo 0)
  BUCKET_EXPECTED[$B]=$EXPECTED
  GOT_DISK=$(find "$OUT/storage/$B" -maxdepth 1 -type f ! -name '.*' -size +0c 2>/dev/null | wc -l)
  BUCKET_GOT[$B]=$GOT_DISK
  if [ "$EXPECTED" = "$GOT_DISK" ]; then
    echo -e "bucket\t${B}\t${EXPECTED}\t${GOT_DISK}\tOK" >> "$REPORT"
  else
    echo -e "bucket\t${B}\t${EXPECTED}\t${GOT_DISK}\tDIFF" >> "$REPORT"
  fi
done

# Valida manifesto storage linha a linha: existe? size bate? sha256 bate?
if [ -f "$MANIFEST_S" ]; then
  # pula header
  tail -n +2 "$MANIFEST_S" | while IFS=$'\t' read -r BK PT BYTES SHA STATUS; do
    [ -z "$BK" ] && continue
    [ "$STATUS" != "OK" ] && continue
    SAFE=$(echo "$PT" | tr '/' '__')
    DEST="$OUT/storage/$BK/$SAFE"
    if [ ! -f "$DEST" ]; then
      echo -e "file\t${BK}/${PT}\t${BYTES}\tMISSING\tMISSING_FILE" >> "$REPORT"
      continue
    fi
    RSIZE=$(stat -c%s "$DEST" 2>/dev/null || echo 0)
    if [ "$RSIZE" != "$BYTES" ]; then
      echo -e "file\t${BK}/${PT}\t${BYTES}\t${RSIZE}\tSIZE_DIFF" >> "$REPORT"
      continue
    fi
    RSHA=$(sha256sum "$DEST" | cut -d' ' -f1)
    if [ "$RSHA" != "$SHA" ]; then
      echo -e "file\t${BK}/${PT}\t${SHA}\t${RSHA}\tSHA_FAIL" >> "$REPORT"
    fi
    # OK = silencioso (não polui relatório com milhares de linhas)
  done
fi

# contadores file-level a partir do report
S_TOTAL=$(grep -cP '^file\t' "$REPORT" || true)
S_MISS=$(grep -cP '\tMISSING_FILE$' "$REPORT" || true)
S_DIFF=$(grep -cP '\tSIZE_DIFF$' "$REPORT" || true)
S_SHA_FAIL=$(grep -cP '\tSHA_FAIL$' "$REPORT" || true)

# ---------- 3) ARQUIVOS ÓRFÃOS (no disco mas não no manifesto) ----------
echo "[3/3] Buscando órfãos (arquivos sem entrada OK no manifesto)..."
ORPHANS=0
for B in $BUCKETS; do
  [[ "$B" =~ $SKIP_BUCKETS_RE ]] && continue
  [ -d "$OUT/storage/$B" ] || continue
  while IFS= read -r F; do
    NAME=$(basename "$F")
    ORIG=$(echo "$NAME" | sed 's|__|/|g')
    if ! grep -qP "^${B}\t${ORIG}\t.*\tOK$" "$MANIFEST_S" 2>/dev/null; then
      echo -e "orphan\t${B}/${ORIG}\t-\t-\tORPHAN" >> "$REPORT"
      ORPHANS=$((ORPHANS+1))
    fi
  done < <(find "$OUT/storage/$B" -maxdepth 1 -type f ! -name '.*' -size +0c)
done

# ---------- SUMÁRIO ----------
TOTAL_BYTES=$(du -sb "$OUT" 2>/dev/null | cut -f1)
TOTAL_HUMAN=$(du -sh "$OUT" 2>/dev/null | cut -f1)

cat > "$SUMMARY" <<EOF
# Backup verify — $(date -u +"%Y-%m-%d %H:%M:%S UTC")

Diretório: \`$OUT\`
Tamanho total: ${TOTAL_HUMAN} (${TOTAL_BYTES} bytes)

## Tabelas (public.*)
- total no banco:    ${T_TOTAL}
- skip (financeiro): ${T_SKIP}
- OK (contagem bate):${T_OK}
- DIFF (contagem diverge): ${T_DIFF}
- MISSING (sem arquivo):   ${T_MISS}
- PARSE_ERR (JSON corrompido): ${T_EMPTY_FILE}

## Storage
- buckets verificados: $(echo "$BUCKETS" | wc -l)
- buckets skip:        ${S_SKIP}
- arquivos checados (manifest OK): ${S_TOTAL}
- MISSING_FILE:        ${S_MISS}
- SIZE_DIFF:           ${S_DIFF}
- SHA_FAIL:            ${S_SHA_FAIL}
- ORPHAN (no disco, fora do manifesto): ${ORPHANS}

## Veredicto
EOF

VERDICT="PASS"
if [ "$T_DIFF" -gt 0 ] || [ "$T_MISS" -gt 0 ] || [ "$T_EMPTY_FILE" -gt 0 ] \
   || [ "$S_MISS" -gt 0 ] || [ "$S_DIFF" -gt 0 ] || [ "$S_SHA_FAIL" -gt 0 ]; then
  VERDICT="FAIL"
fi
echo "**${VERDICT}**" >> "$SUMMARY"
echo "" >> "$SUMMARY"
echo "Relatório completo: \`_verify-report.tsv\` (filtrar por status != OK)" >> "$SUMMARY"

# Bucket-level breakdown
echo "" >> "$SUMMARY"
echo "## Buckets (esperado vs disco)" >> "$SUMMARY"
for B in "${!BUCKET_EXPECTED[@]}"; do
  echo "- ${B}: ${BUCKET_GOT[$B]} / ${BUCKET_EXPECTED[$B]}" >> "$SUMMARY"
done

echo ""
echo "===================== SUMÁRIO ====================="
cat "$SUMMARY"
echo "==================================================="
echo ""
echo "Detalhes: $REPORT"
echo "Veredicto: $VERDICT"
[ "$VERDICT" = "PASS" ] && exit 0 || exit 2
