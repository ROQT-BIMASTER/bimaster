---
name: Copilot v2 Canonical Path
description: Fase 6 concluída 2026-06-10 — front-end sempre invoca `<copilot>-v2` (central/projeto/estoque/china-submission); flags `ff_copilot_v2_*`, hook `useCopilotV2Flag` e painel `/dashboard/admin/copilot-v2-rollout` foram removidos; legados continuam internos como backend dos wrappers via `proxy-legacy.ts`
type: feature
---

Arquitetura final dos copilotos (pós-Fase 6):

- **Único ponto de entrada do cliente**: `central-copilot-v2`, `projeto-copilot-v2`, `estoque-copilot-v2`, `china-submission-copilot-v2`. Os hooks `useCentralCopilot`, `useProjetoCopilot`, `useEstoqueCopilot` e o componente `SubmissionCopilotPanel` invocam diretamente o nome `-v2`, sem flag.
- **Contratos C1/C2 sempre aplicados**: `wrapLegacyCopilotReply` (em `_shared/copilot-tools/contract-wrap.ts`) roda em 100% das respostas, gravando `copilot_runs` com `copilot_id='<id>@v2'`, `citations_count`, `unverifiable_numbers`, `latency_ms`, `meta.contract_version='v2.0'`.
- **Indexação RAG hot**: `enqueueCopilotDoc` continua ativo em todos os wrappers (`sourceType='copilot_thread'`, `priority='hot'`).
- **Legados como implementação interna**: `central-copilot`, `projeto-copilot`, `estoque-copilot`, `china-submission-copilot` permanecem como edge functions chamadas via `callLegacyCopilot` (`_shared/copilot-tools/proxy-legacy.ts`) com o JWT do usuário propagado (RLS preservada). Eles **não devem ser invocados diretamente pelo front-end** — sempre passar pelo wrapper `-v2`.
- **Removido nesta fase**: `feature_flags` linhas `ff_copilot_v2_*` (DELETE), hook `src/hooks/useCopilotV2Flag.ts`, página `src/pages/admin/CopilotV2Rollout.tsx`, rota `/dashboard/admin/copilot-v2-rollout`, RPC `admin_set_copilot_v2_flag(text,boolean)`. RPC `admin_copilot_v2_stats(p_days)` mantida (telemetria histórica).

Observabilidade contínua:
- `SELECT * FROM copilot_runs WHERE copilot_id LIKE '%@v2' AND created_at > now()-interval '7 days'` para volume/latência por copiloto.
- Cron `copilot-rag-indexer-hot-every-minute` drena `copilot_index_queue priority=hot`.
- Cron `reports-alerts-evaluator-every-5min`.

Quando adicionar um novo copiloto, criar **somente** o wrapper `-v2` chamando o backend interno via `proxy-legacy.ts` (ou inline). Não recriar o padrão de flag/legacy switch.

Tabelas/Edge envolvidas: `copilot_runs`, `copilot_documents`, `copilot_chunks`, `copilot_index_queue`, `enqueue_copilot_document`, `_shared/copilot-tools/contract-wrap.ts`, `_shared/copilot-tools/proxy-legacy.ts`, `_shared/copilot-tools/enqueue-doc.ts`, `admin_copilot_v2_stats`.
