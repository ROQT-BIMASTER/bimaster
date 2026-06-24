#!/usr/bin/env bash
# canary-submissao-projeto.sh
# Verifica em produção que a unificação Submissão↔Projeto não regrediu.
#
# Falha se:
#   1. Existir qualquer submissão China com mais de um projeto vinculado.
#   2. O índice UNIQUE de defesa (Fase 6) tiver sumido.
#
# Uso (requer PG* env vars do sandbox managed Supabase):
#   bash scripts/security/canary-submissao-projeto.sh
#
# Integrar no CI noturno ou no workflow security-rls-e2e.yml.

set -euo pipefail

if [ -z "${PGHOST:-}" ]; then
  echo "ERRO: PG* env vars ausentes — não consegui conectar ao banco." >&2
  exit 2
fi

echo "[canary] Verificando duplicatas em china_submissao_projetos..."
DUP_COUNT=$(psql -tA -c "
  SELECT count(*) FROM (
    SELECT submissao_id FROM public.china_submissao_projetos
    GROUP BY submissao_id HAVING count(*) > 1
  ) s;
")
if [ "$DUP_COUNT" != "0" ]; then
  echo "FAIL: $DUP_COUNT submissão(ões) com vínculo duplicado." >&2
  psql -c "
    SELECT submissao_id, count(*) AS n
    FROM public.china_submissao_projetos
    GROUP BY submissao_id HAVING count(*) > 1
    ORDER BY n DESC LIMIT 20;
  " >&2
  exit 1
fi
echo "[canary] OK — 0 duplicatas."

echo "[canary] Verificando índice UNIQUE da Fase 6..."
HAS_UNIQUE=$(psql -tA -c "
  SELECT count(*) FROM pg_indexes
  WHERE schemaname='public'
    AND tablename='china_submissao_projetos'
    AND indexname='china_submissao_projetos_submissao_id_uniq';
")
if [ "$HAS_UNIQUE" != "1" ]; then
  echo "FAIL: índice UNIQUE 'china_submissao_projetos_submissao_id_uniq' não existe." >&2
  exit 1
fi
echo "[canary] OK — índice UNIQUE presente."

echo "[canary] Tudo verde."
