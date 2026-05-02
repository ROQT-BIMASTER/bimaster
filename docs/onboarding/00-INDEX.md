---
title: Onboarding bimaster — Índice
audience: ai-coding-agent
last_updated: 2026-05-02
---

# Onboarding `bimaster`

Pacote canônico de documentação para devs (humanos ou IAs) que vão trabalhar
neste repositório. Para o resumo executivo, ver [`/AGENTS.md`](../../AGENTS.md).
Para colar como system prompt em IA externa, ver [`/AI_CONTEXT.md`](../../AI_CONTEXT.md).

## Roteiro de leitura

| # | Arquivo | Quando ler |
|---|---|---|
| 01 | [Stack & Setup](./01-STACK-AND-SETUP.md) | Sempre primeiro |
| 02 | [Arquitetura](./02-ARCHITECTURE.md) | Antes de qualquer mudança estrutural |
| 03 | [Módulos de negócio](./03-MODULES.md) | Quando o pedido envolver um módulo específico |
| 04 | [Database & RLS](./04-DATABASE-AND-RLS.md) | Antes de migrations ou policies |
| 05 | [Edge Functions](./05-EDGE-FUNCTIONS.md) | Antes de criar/editar função Deno |
| 06 | [IA & Copilots](./06-AI-AND-COPILOT.md) | Para qualquer feature com IA |
| 07 | [Segurança & LGPD](./07-SECURITY-AND-LGPD.md) | Sempre que tocar dados pessoais ou storage |
| 08 | [UI / Design system](./08-UI-DESIGN-SYSTEM.md) | Para qualquer mudança visual |
| 09 | [Finance deep-dive](./09-FINANCE-DEEP-DIVE.md) | Para DRE, AP/AR, Sofia, custos |
| 10 | [Integrações externas](./10-INTEGRATIONS.md) | Asana, Shipsgo, Phyllo, Apify, Pluggy, ERP |
| 11 | [Testes & CI](./11-TESTING-AND-CI.md) | Para mudanças que afetam comportamento crítico |
| 12 | [Release & changelog](./12-RELEASE-AND-CHANGELOG.md) | Para bumps de SDK / OpenAPI / `APP_VERSION` |
| 13 | [Gotchas](./13-GOTCHAS.md) | Lista única de armadilhas — leia antes do primeiro PR |

## Convenções desta documentação

- Cada arquivo abre com bloco YAML simples (`title`, `audience`, `last_updated`).
- Snippets curtos referenciam o caminho real (`src/...`, `supabase/functions/...`).
- Sem narrativa pessoal; tom imperativo.
- Credenciais sempre como placeholders (`<your-project-url>`, etc.).
