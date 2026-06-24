# `.memory/` — Índice

Memórias específicas de projeto, persistidas no repositório (espelho das memórias internas do Lovable). Lidas por agentes externos (Cursor, Claude Code, Aider) que clonam o repo do GitHub.

> Para agentes operando dentro do Lovable, o índice canônico vive em `mem://index.md` (sempre em contexto). Este `.memory/` é a versão portátil para fora.

## Convenção

Cada arquivo tem frontmatter YAML:

```yaml
---
name: Nome curto
description: Resumo de uma linha
type: feature | preference | design | constraint | reference
---
```

## Memórias atuais

### `ai/`
- [`copilot-v2-rollout-pattern.md`](./ai/copilot-v2-rollout-pattern.md) — Arquitetura final dos copilotos pós-Fase 6: front sempre invoca `<copilot>-v2`, contratos C1/C2 sempre aplicados, legados como backend interno via `proxy-legacy.ts`.

### `features/`
- [`china/upload-documentos-hardening.md`](./features/china/upload-documentos-hardening.md) — Invariantes do upload de documentos China: coluna `observacao`, validação local + magic bytes, path sanitizado, retry com backoff, rollback transacional, preview com sandbox.
- [`china/unificacao-submissao-projeto.md`](./features/china/unificacao-submissao-projeto.md) — Fonte única `ProjectService` + UNIQUE no banco + flags + canary. Fases 1–7 entregues; 8+ pendentes.
- [`fabrica-price-limits-per-table.md`](./features/fabrica-price-limits-per-table.md) — Limites de preço por tabela no módulo Fábrica.

### `preferences/`
- [`date-timezone-guard.md`](./preferences/date-timezone-guard.md) — Proibição de `new Date(string)` em colunas Postgres `DATE`; uso obrigatório de `parseLocalDate`. CI valida via `audit/date-tz-guard.sh`.

## Como adicionar

1. Crie o arquivo em `.memory/<tipo>/<slug>.md` com frontmatter.
2. Adicione uma linha aqui sob a seção apropriada.
3. Commit normalmente — Lovable sincroniza com GitHub.
