#!/usr/bin/env bash
# scripts/recovery/backup-full-pre-restore.sh
# Snapshot COMPLETO PRÉ-RESTORE: dump JSON de TODAS as tabelas public.* +
# download de TODOS os arquivos de TODOS os buckets.
#
# Objetivo: permitir, após o restore via suporte Lovable, re-inserir os dados
# criados/atualizados após o incidente sem que usuários em produção percebam.
# Estratégia de merge (ver _restore-plan.md): INSERT ... ON CONFLICT DO NOTHING
# para tabelas; upload com upsert=false para storage.
set -uo pipefail

TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="/mnt/documents/backup-full-${TS}"
mkdir -p "$OUT/tables" "$OUT/storage"

SUPABASE_URL="${SUPABASE_URL:?}"
APIKEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_PUBLISHABLE_KEY:-}}"
BACKUP_TOKEN="${BACKUP_TOKEN:?defina BACKUP_TOKEN no ambiente antes de rodar}"
SIGN_URL="${SUPABASE_URL}/functions/v1/backup-signed-urls"

echo "[1/3] Dumping TODAS as tabelas public.* para JSON..."
TABLES=$(psql -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")

: > "$OUT/tables/_manifest.tsv"
echo -e "table\trows\tbytes\tstatus" >> "$OUT/tables/_manifest.tsv"

TOTAL=0; OK=0; FAIL=0
for T in $TABLES; do
  TOTAL=$((TOTAL+1))
  CNT=$(psql -t -A -c "SELECT count(*) FROM public.\"$T\";" 2>/dev/null || echo "?")
  FILE="$OUT/tables/${T}.json"
  if psql -t -A -c "COPY (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.\"$T\" r) TO STDOUT;" > "$FILE" 2>/dev/null; then
    SIZE=$(stat -c%s "$FILE")
    echo -e "${T}\t${CNT}\t${SIZE}\tOK" >> "$OUT/tables/_manifest.tsv"
    OK=$((OK+1))
  else
    echo "[]" > "$FILE"
    SIZE=$(stat -c%s "$FILE")
    echo -e "${T}\t${CNT}\t${SIZE}\tFAIL" >> "$OUT/tables/_manifest.tsv"
    FAIL=$((FAIL+1))
  fi
  if [ $((TOTAL % 50)) -eq 0 ]; then echo "  ...$TOTAL tabelas processadas"; fi
done
echo "  tabelas: $TOTAL  ok: $OK  fail: $FAIL"

echo "[2/3] Baixando TODOS os buckets..."
BUCKETS=$(psql -t -A -c "SELECT id FROM storage.buckets ORDER BY id;")

: > "$OUT/storage/_manifest.tsv"
echo -e "bucket\tpath\tbytes\tsha256\tstatus" >> "$OUT/storage/_manifest.tsv"

for B in $BUCKETS; do
  BCOUNT=$(psql -t -A -c "SELECT count(*) FROM storage.objects WHERE bucket_id='$B';" 2>/dev/null || echo 0)
  if [ "$BCOUNT" = "0" ]; then continue; fi
  echo "  bucket: $B ($BCOUNT objetos)"
  mkdir -p "$OUT/storage/$B"
  PATHS=$(psql -t -A -c "SELECT name FROM storage.objects WHERE bucket_id='$B' ORDER BY name;")

  echo "$PATHS" | python3 -c "
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
d=json.load(sys.stdin)
for r in d.get('results',[]):
    print('\t'.join([r['bucket'],r['path'],r.get('url',''),r.get('error','')]))
" | while IFS=$'\t' read -r BK PT URL ERR; do
      [ -z "$PT" ] && continue
      SAFE=$(echo "$PT" | tr '/' '__')
      DEST="$OUT/storage/$BK/$SAFE"
      if [ -z "$URL" ]; then
        echo -e "${BK}\t${PT}\t-\t-\tSIGN_FAIL:${ERR}" >> "$OUT/storage/_manifest.tsv"; continue
      fi
      HTTP=$(curl -sS -L -o "$DEST" -w '%{http_code}' --max-time 300 "$URL" 2>/dev/null || echo "000")
      if [ "$HTTP" != "200" ]; then
        rm -f "$DEST"
        echo -e "${BK}\t${PT}\t-\t-\tHTTP_${HTTP}" >> "$OUT/storage/_manifest.tsv"; continue
      fi
      SHA=$(sha256sum "$DEST" | cut -d' ' -f1)
      RSIZE=$(stat -c%s "$DEST")
      echo -e "${BK}\t${PT}\t${RSIZE}\t${SHA}\tOK" >> "$OUT/storage/_manifest.tsv"
    done
  done
  DONE=$(grep -cP "^${B}\t.*\tOK$" "$OUT/storage/_manifest.tsv" || true)
  echo "    ok: $DONE / $BCOUNT"
done

echo "[3/3] README + restore plan + zip..."
cat > "$OUT/README.md" <<EOF
# Backup COMPLETO pré-restore — ${TS}
Snapshot tirado em $(date -u +"%Y-%m-%d %H:%M:%S UTC").

## Conteúdo
- \`tables/*.json\`       : dump JSON de TODAS as tabelas public.* (${TOTAL} tabelas)
- \`tables/_manifest.tsv\`: contagens e status por tabela
- \`storage/<bucket>/\`   : todos os arquivos de todos os buckets (paths com / -> __)
- \`storage/_manifest.tsv\`: path original + sha256 + status
- \`_restore-plan.md\`    : passo-a-passo de reimport pós-restore
EOF

cat > "$OUT/_restore-plan.md" <<'EOF'
# Plano de Reimport Pós-Restore (zero impacto a usuários)

## Premissa
O suporte Lovable restaura o banco/storage para snapshot anterior a 2026-05-16 01:23 UTC.
Após o restore, este backup é re-aplicado para devolver TUDO que aconteceu depois,
sem sobrescrever dados restaurados (evita perda) e sem duplicar (evita conflitos).

## Tabelas
Para cada `tables/<T>.json`:
1. Conferir se a tabela tem PK `id uuid` (case maioria).
2. Carregar em tabela temporária e fazer:
   ```sql
   INSERT INTO public."<T>" SELECT * FROM _tmp_<T>
   ON CONFLICT (id) DO NOTHING;
   ```
   - `DO NOTHING` garante que linhas restauradas (que já estavam antes do incidente)
     permanecem; apenas rows criadas após o incidente são re-inseridas.
3. Para tabelas sem `id` simples (junctions), usar a PK composta correspondente.
4. Tabelas com `updated_at`: opcionalmente, para rows com `updated_at > '2026-05-16 01:23Z'`
   no backup, fazer UPDATE manual (avaliar caso a caso — pode reverter correções).

## Storage
Para cada linha OK em `storage/_manifest.tsv`:
1. Upload com `upsert: false` no path original (`bucket`, `path`).
2. Se já existir após restore -> ignorar (mantém versão restaurada).
3. Se não existir -> arquivo é re-inserido (cobre uploads pós-incidente).

## Validação
- Comparar `count(*)` por tabela: restaurado + reinserido >= backup.
- Comparar sha256 por arquivo storage para amostras críticas.
- Smoke test nos módulos: Fábrica China, Projetos, Financeiro AP/AR, Trade.

## Janela operacional
Reimport roda em background sem downtime. Usuários conseguem operar normalmente —
o ON CONFLICT garante idempotência mesmo se um usuário recriar manualmente o mesmo
registro durante a janela.
EOF

cd /mnt/documents && zip -qr "backup-full-${TS}.zip" "backup-full-${TS}"
SZ=$(du -h "/mnt/documents/backup-full-${TS}.zip" | cut -f1)
echo "OK: /mnt/documents/backup-full-${TS}.zip ($SZ)"
