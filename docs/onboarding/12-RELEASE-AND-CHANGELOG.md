---
title: Release & Changelog
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 12 — Release & Changelog

## Disciplina de changelog

> **Toda mudança em SDK público, OpenAPI ou bump de `APP_VERSION` exige
> entrada correspondente em `src/pages/admin/ApiDocumentation.tsx`.**
>
> O CI roda grep para verificar (workflow `regression-greps.yml`). Se faltar,
> o build de PR falha.

Memória: `mem://process/release-changelog-discipline`.

## Quando atualizar o changelog

| Mudança | Atualizar? |
|---|---|
| Nova rota / endpoint REST | ✅ Sim |
| Mudança de contrato (campo, tipo, status) em rota existente | ✅ Sim |
| Bump de versão da OpenAPI (`docs/API_*.md`) | ✅ Sim |
| Bump de `APP_VERSION` | ✅ Sim |
| Bug fix interno sem mudar contrato | ❌ Não |
| Refatoração de UI | ❌ Não |

## Formato da entrada

Em `src/pages/admin/ApiDocumentation.tsx`, adicione no topo da lista de versões
um item com:

- versão (semver)
- data (`YYYY-MM-DD`)
- categoria (`added` / `changed` / `deprecated` / `removed` / `fixed` /
  `security`)
- descrição curta em PT-BR

Exemplo (estrutura de referência — confira o arquivo atual antes de seguir o
formato exato):

```tsx
{
  version: "2026.05.02",
  date: "2026-05-02",
  changes: [
    { type: "added", text: "Endpoint POST /api/projetos/:id/copilot/relatorio." },
    { type: "fixed", text: "Cálculo de DPO ignorando feriados nacionais." },
  ],
},
```

## Versionamento

- Frontend: tag interna em `APP_VERSION` (procure com `rg "APP_VERSION"`).
- API REST: documentado em cada `docs/API_*.md` com data de última revisão.
- Edge Functions: deploy automático no push (Lovable Cloud / Supabase).

## Deploy

- **Lovable Cloud**: deploy automático em cada push para `main` (via sync
  GitHub).
- **Edge Functions**: deploy automático ao salvar `supabase/functions/*`.
- **Cloudflare Worker**: `wrangler deploy` se `cloudflare/` mudar
  (hoje manual; ver `cloudflare/wrangler.toml`).
- **Netlify / Vercel**: alternativas configuradas (`netlify.toml`,
  `vercel.json`).

## Publish (Lovable)

- Botão **Publish** no editor Lovable atualiza `https://<slug>.lovable.app`.
- Para custom domain, configurar em Project Settings → Domains.
- Sugira ao usuário publicar **após milestones**, não a cada commit.

## Backups & DR

- Script de drill em `scripts/dr/drill.sh`.
- Snapshot de SECURITY DEFINER functions em
  `scripts/audit/security-definer-snapshot.mjs` — útil para revisar privilégios
  antes de release.

## Pré-release checklist

- [ ] `bunx vitest run` passa.
- [ ] `bash scripts/security/e2e-anonymous-sensitive-columns.sh` passa.
- [ ] `bash scripts/security/e2e-authenticated-sensitive-columns.sh` passa.
- [ ] Changelog atualizado se houver mudança de contrato.
- [ ] `mem://index.md` atualizado se houver nova convenção / módulo.
- [ ] Migrations testadas em ambiente de teste antes de produção.
