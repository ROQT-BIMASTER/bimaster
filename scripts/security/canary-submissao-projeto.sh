#!/usr/bin/env bash
# canary-submissao-projeto.sh
# Verifica que a unificação Submissão↔Projeto não regrediu.
#
# Falha se:
#   1. Existir qualquer submissão China com mais de um projeto vinculado.
#   2. O índice UNIQUE de defesa (Fase 6) tiver sumido.
#
# Funciona em CI usando apenas SUPABASE_URL + SUPABASE_ANON_KEY
# (chama public.rpc_canary_submissao_projeto_unicidade — SECURITY DEFINER,
# retorna só contadores agregados, zero PII).
#
# Local com psql disponível: também aceita PG* env vars como fallback.

set -euo pipefail

URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
KEY="${SUPABASE_ANON_KEY:-${VITE_SUPABASE_PUBLISHABLE_KEY:-}}"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  if [ -n "${PGHOST:-}" ]; then
    echo "[canary] SUPABASE_URL/ANON_KEY ausentes — caindo para psql direto." >&2
    DUP=$(psql -tA -c "SELECT count(*) FROM (SELECT submissao_id FROM public.china_submissao_projetos GROUP BY 1 HAVING count(*) > 1) s;")
    IDX=$(psql -tA -c "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='china_submissao_projetos_submissao_id_uniq');")
    [ "$DUP" = "0" ] || { echo "FAIL: $DUP duplicatas." >&2; exit 1; }
    [ "$IDX" = "t" ] || { echo "FAIL: índice UNIQUE ausente." >&2; exit 1; }
    echo "[canary] OK (via psql)."
    exit 0
  fi
  echo "ERRO: defina SUPABASE_URL e SUPABASE_ANON_KEY (ou PG* env)." >&2
  exit 2
fi

echo "[canary] Chamando rpc_canary_submissao_projeto_unicidade..."
RESP=$(curl -fsS -X POST "${URL}/rest/v1/rpc/rpc_canary_submissao_projeto_unicidade" \
  -H "apikey: ${KEY}" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "[canary] Resposta: ${RESP}"

DUP=$(echo "$RESP" | grep -o '"duplicates"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$')
IDX=$(echo "$RESP" | grep -o '"unique_index_present"[[:space:]]*:[[:space:]]*\(true\|false\)' | grep -o '\(true\|false\)$')

if [ "${DUP:-x}" != "0" ]; then
  echo "FAIL: ${DUP:-?} submissão(ões) com vínculo duplicado." >&2
  exit 1
fi
if [ "${IDX:-x}" != "true" ]; then
  echo "FAIL: índice UNIQUE 'china_submissao_projetos_submissao_id_uniq' não existe." >&2
  exit 1
fi

echo "[canary] OK — 0 duplicatas, UNIQUE presente."
