---
name: Copilot v2 Rollout Pattern
description: Wrappers `<copilot>-v2` aplicam contrato C1/C2, gravam `copilot_runs` com `copilot_id='<id>@v2'` e painel admin `/dashboard/admin/copilot-v2-rollout` controla flags `ff_copilot_v2_*` (default ON em 2026-06-10 para central/projeto/estoque/china; sofia segue OFF até migrar chat textual)
type: feature
---

Observabilidade (Fase 6-prep): contract-wrap grava em `copilot_runs` usando colunas reais (`copilot_id` sufixado `@v2`, `citations_count`, `unverifiable_numbers`, `rag_breach_blocked`, `latency_ms`, `error_code='exec_summary_stripped'` quando aplica). RPCs `admin_copilot_v2_stats(p_days)` e `admin_set_copilot_v2_flag(p_codigo,p_ativo)` (SECURITY DEFINER, gated por `has_role(...,'admin')`) alimentam o painel `src/pages/admin/CopilotV2Rollout.tsx`. Critério de promoção para Fase 6: ≥80% v2 + ≤0,20 números não verificáveis por resposta durante 14 dias.

Estratégia de migração incremental (Fases 1–4) sem reescrever os copilotos legados:

- Edge functions wrapper: `central-copilot-v2`, `projeto-copilot-v2`, `estoque-copilot-v2`, `china-submission-copilot-v2`. Sofia ainda não tem chat invoke direto (usa `sofia-voice-token`), portanto a flag `ff_copilot_v2_sofia` está reservada para quando o chat textual for migrado.
- Cada wrapper: Zod `passthrough()` (legacy detém schema completo) → `callLegacyCopilot` reencaminhando o `Authorization` do usuário (RLS preservada) → `wrapLegacyCopilotReply` aplica os contratos C1 (citações por fonte) e C2 (números — números sem fonte viram aviso visível e disparam `executive_summary_stripped=true`) e grava 1 linha em `copilot_runs` com `meta.unverifiable_count`, `meta.rag_breach_blocked=0`, `meta.contract_version='v2.0'`.
- Front-end: hook `useCopilotV2Flag(copilotId)` lê `feature_flags.ativo` por `codigo='ff_copilot_v2_<id>'` (cache em memória). Hooks `useCentralCopilot`, `useProjetoCopilot` e `useEstoqueCopilot` trocam o nome da função invocada quando a flag está on. **Default = off** — rollback é desligar a flag.
- Forma de resposta preservada: nenhum componente de UI legado precisou mudar; o wrapper devolve os mesmos campos (`reply`, `sources`, `proposals`, `reports`, `model`) e adiciona `meta.copilot_v2.*`.
- Observability: queries em `copilot_runs WHERE meta->>'contract_version'='v2.0'` por `copilot_id` mostram volume v2 e ratio de números não verificáveis.
- Crons (pg_cron + pg_net): `copilot-rag-indexer-hot-every-minute` (drena `copilot_index_queue` priority=hot) e `reports-alerts-evaluator-every-5min`.

Fase 5 (implementada — junho/2026):
- RPC `enqueue_copilot_document(p_copilot_id,p_source_type,p_source_ref,p_title,p_content,p_acl_scope,p_metadata,p_priority,p_created_by)` SECURITY DEFINER, EXECUTE só para `service_role` (revogado de PUBLIC/anon/authenticated). Faz upsert idempotente em `copilot_documents` por `(copilot_id, source_type, source_ref) WHERE archived_at IS NULL`, limpa `copilot_chunks` antigos e enfileira em `copilot_index_queue`.
- Helper `_shared/copilot-tools/enqueue-doc.ts` (`enqueueCopilotDoc`) — best-effort, nunca lança. Cada wrapper v2 chama após `wrapLegacyCopilotReply` com `sourceType='copilot_thread'`, `sourceRef = thread_id ?? run_id`, `aclScope={owner:userId, ...escopo}`, `priority='hot'` (texto curto Q+A entra inline ≤2KB, caso contrário fila).
- Não foram adicionadas triggers em tabelas de negócio (alto volume + risco): pipeline RAG v2 só consome o que os wrappers v2 produzem mais o que for inserido sob demanda por scripts/admin.

Próxima fase:
- Fase 6: depois de 2 semanas com flag default-on sem incidentes, inlinear o wrapper dentro do legado e remover a duplicação.

Tabelas/Edge envolvidas: `feature_flags`, `copilot_runs`, `copilot_documents`, `copilot_chunks`, `copilot_index_queue`, `enqueue_copilot_document`, `_shared/copilot-tools/contract-wrap.ts`, `_shared/copilot-tools/proxy-legacy.ts`, `_shared/copilot-tools/enqueue-doc.ts`.
