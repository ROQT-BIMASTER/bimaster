---
name: Unificação Submissão↔Projeto China
description: Fonte única ProjectService + UNIQUE no banco + flags ff_unificacao_vincular_china/ff_projeto_foto_oficial + canary
type: feature
---
Toda criação de projeto a partir de submissão China DEVE passar por `ProjectService` em `src/lib/projetos/projectService.ts`. Nunca chamar `rpc_china_criar_projeto_espelho` direto.

- `ProjectService.findBySubmission(id)` retorna o vínculo existente (prefere `is_espelho=true`). Chamar SEMPRE antes de criar.
- `ProjectService.createFromSubmission(id, opts)` é idempotente; delega ao RPC.
- Banco tem `UNIQUE INDEX china_submissao_projetos_submissao_id_uniq` (Fase 6) — rejeita duplicatas com 23505.
- Flag `ff_unificacao_vincular_china` controla banner/redirect na tela `/vincular-china` (Fase 4). Default off.
- Flag `ff_projeto_foto_oficial` controla colunas `china_produto_submissoes.foto_oficial_*` + bucket `china-submissao-foto-oficial` (Fase 3). Default off.
- Projetos arquivados na Fase 5 têm `projetos.metadata->>'unificado_em'` apontando para o canônico. Reversível.
- Canary obrigatório: `scripts/security/canary-submissao-projeto.sh` (duplicatas + presença do UNIQUE).
- Suite de regressão: `src/lib/projetos/__tests__/projectService.test.ts` (7 testes).
- Docs completos: `docs/onboarding/submissao-projeto-unificacao/` (AS-IS, duplicidades, FASE-5/7).

Fases 8+ (consolidação de RPC, eliminação de hooks duplicados, audit AI unificada) ainda pendentes.
