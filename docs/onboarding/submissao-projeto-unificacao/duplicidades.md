# Duplicidades — Submissão → Projeto

Status em 2026-06-24 — pós Fase 7. Legenda: ✅ resolvido · 🟡 mitigado (gated por flag) · ⏳ pendente.

| # | Status | Item | Como foi resolvido |
|---|:-:|---|---|
| 1 | 🟡 | Dois hooks de criação de projeto | `useCriarProjetoChina` agora chama `ProjectService.findBySubmission` antes de criar (idempotência — Fase 1). Substituição completa fica para Fase 8 (atrás de flag). |
| 2 | ⏳ | Dois RPCs independentes | Mantidos. `ProjectService` delega ao `rpc_china_criar_projeto_espelho`. Consolidação no RPC fica para Fase 8. |
| 3 | 🟡 | Tarefas hardcoded em código frontend | Extraído para `src/lib/projetos/checklistTarefas.ts` (Fase 10) — fonte única para consumers existentes. `useChinaProjeto` re-exporta para compatibilidade. Substituição completa pelo template B2C ainda fica para Fase 11+. |
| 4 | ⏳ | Duas tabelas de linkagem tarefa↔submissão | Documentado; consolidação fora do escopo atual. |
| 5 | ✅ | Ausência de UNIQUE em `china_submissao_projetos.submissao_id` | Backfill (Fase 5, Opção B) + `UNIQUE INDEX` (Fase 6). Canary diário em `scripts/security/canary-submissao-projeto.sh`. |
| 6 | 🟡 | Tela "Vincular China" distinta da Ficha | Banner informativo em `ProjetoVincularChina` atrás de `ff_unificacao_vincular_china` (Fase 4). Ativação gradual. |
| 7 | ✅ | Projetos do Fluxo 1 invisíveis na Mesa China | Backfill (Fase 9) marcou todos os vínculos como `is_espelho=true` — agora válido por construção, já que o `UNIQUE` da Fase 6 garante 1 vínculo por submissão. Default da coluna passou a `true`. Filtros existentes (`.eq('is_espelho', true)`) param de esconder projetos legados. |
| 8 | ⏳ | Documentos da submissão não chegam às tarefas | Fica para Fase 8 (depende da consolidação do RPC). |
| 9 | ✅ | Ausência de "foto oficial" | Colunas `foto_oficial_*` + bucket dedicado `china-submissao-foto-oficial` (Fase 3, atrás de `ff_projeto_foto_oficial`). |
| 10 | ⏳ | Configuração de prazos só no Fluxo 2 | Fica para Fase 8. |
| 11 | ⏳ | Status inicial em locais diferentes | Fica para Fase 8 (consolidação do RPC). |
| 12 | ⏳ | Audit AI só roda no Fluxo 1 | Fica para Fase 8. |

## Defesas ativas hoje

- `UNIQUE INDEX china_submissao_projetos_submissao_id_uniq` — banco rejeita duplicatas.
- `ProjectService.findBySubmission` chamado antes de qualquer create no Fluxo 1.
- Canary `scripts/security/canary-submissao-projeto.sh` — checa duplicatas + presença do índice.
- Suite `src/lib/projetos/__tests__/projectService.test.ts` — 7 testes de regressão.
- Auditoria estruturada em `projetos.metadata` (`unificado_em`, `unificacao_motivo`, etc.) para todos os projetos arquivados na Fase 5. Reversível.
