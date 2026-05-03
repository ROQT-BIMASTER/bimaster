# Profissionalização do repositório Bi Master

Limpeza ampla em 4 lotes, sem alterar comportamento de runtime nem reescrever git history. Cada lote é um PR independente, aprovado antes do próximo.

## Lote 1 — Limpeza segura (sem mudança funcional)

### 1.1 Apagar lixo de processo no root
Apagar (após confirmar existência via `ls`):
- `ACESSIBILIDADE_CORRIGIDA.md`
- `CHECKLIST_PRODUCAO.md`
- `MELHORIAS_IMPLEMENTADAS.md` (se existir)
- `PROBLEMAS_CONSOLE_RESOLVIDOS.md`
- `PROJETO_FINALIZADO.md`
- `SECURITY_FIXES_WEEK4.md` (se existir)
- `SEGURANCA_100_PRONTO.md` (se existir)
- `SEGURANCA_PRODUCAO.md`
- `SEMANA2_COMPLETA.md`, `SEMANA3_COMPLETA.md`, `SEMANA5_COMPLETA.md`, `SEMANA4_COMPLETA.md` (se existir)
- `TRADE_PERFORMANCE_COMPLETO.md`
- `HIERARQUIA_USUARIOS.md` (avaliar — se for log de processo, apagar; se documentar regra de negócio, mover para `docs/`)

### 1.2 Apagar prompts de processo em `docs/`
- `rg --files docs/ | grep -i "PROMPT-LOVABLE"` → apagar todos os matches
- Varrer `docs/*.md` por padrões `_FIX_`, `_RESOLVIDO_`, `_CONCLUIDO_`, "Semana N", "Fase N concluída", "fixes-abr26" → apagar logs temporais sem valor de referência
- Manter intactos: `ARCHITECTURE*.md`, `MODULES*.md`, `API_*.md`, `DEPLOYMENT.md`, `EDGE_*.md`, `SECURITY*.md` (consolidados no Lote 3), `TESTING.md`, `onboarding/**`

### 1.3 Adicionar artefatos profissionais
Criar (ou substituir se genéricos):
- `LICENSE` — proprietário Bi Master, copyright 2024–2026
- `SECURITY.md` na raiz — política de disclosure + link para `docs/security/`
- `CONTRIBUTING.md` — setup, branch model, PR checklist, link para AGENTS.md
- `CHANGELOG.md` — Keep a Changelog vazio (sem retroatividade)
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/CODEOWNERS` — placeholder por área (financeiro, trade, fábrica, projetos, marketing, china, admin)

## Lote 2 — Reescrita de documentos top-level

### 2.1 `README.md`
Substituir pelo template Bi Master (stack, quickstart, comandos, estrutura, links de docs, licença). Validar números reais antes (`ls supabase/functions | wc -l`, `ls supabase/migrations | wc -l`).

### 2.2 `AGENTS.md`
Manter regras técnicas (RLS, secureHandler, parseLocalDate, Zod, etc.). Reescrever cabeçalho e tom como "guia interno Bi Master para code agents". Remover frases que tratam Lovable como ator/IDE/processo. Preservar referências a Lovable Cloud / AI Gateway nas seções de infraestrutura (são reais e devem ficar transparentes).

### 2.3 `AI_CONTEXT.md`
Comparar com `docs/onboarding/00-INDEX.md`. Se for derivado, apagar e adicionar nota em `AGENTS.md` apontando para `docs/onboarding/`. Se tiver conteúdo único, consolidar em `docs/onboarding/`.

### 2.4 `docs/INFRASTRUCTURE.md`
Criar (ou atualizar se já existir) com seção honesta sobre dependências: hosting (Lovable + Cloudflare), Supabase Cloud (project ref real), AI Gateway (`ai.gateway.lovable.dev`), `lovable-tagger` devDep, `cdn.gpteng.co` no CSP. Transparência > esconder.

## Lote 3 — Consolidação de docs de segurança

### 3.1 Mover `docs/SECURITY-*.md` → `docs/security/`
Renomear removendo prefixo `SECURITY-`:
- `SECURITY-SSRF-COVERAGE.md` → `security/SSRF-COVERAGE.md`
- `SECURITY-STORAGE-AUDIT.md` → `security/STORAGE-AUDIT.md`
- `SECURITY-STORAGE-DISCOVERY.md` → `security/STORAGE-DISCOVERY.md`
- `SECURITY-STEPUP-AUDITLOG.md` → `security/STEPUP-AUDITLOG.md`
- `SECURITY-FAIL-CLOSED-MFA.md` → `security/FAIL-CLOSED-MFA.md`
- `SECURITY-INPUT-VALIDATION.md` → `security/INPUT-VALIDATION.md`
- `SECURITY-ZOD-STRICT-COVERAGE.md` → `security/ZOD-STRICT-COVERAGE.md`
- `SECURITY-WEBHOOKS-HMAC.md` → `security/WEBHOOKS-HMAC.md`
- `SECURITY-CORS-LOCKDOWN.md` → `security/CORS-LOCKDOWN.md`
- `SECURITY-FINDINGS-M-SERIES.md` → `security/FINDINGS-M-SERIES.md`
- `SECURITY-HEADERS-DEPLOY.md` → `security/HEADERS-DEPLOY.md`
- `SECURITY-HARDENING-COMPLETE.md` → `security/HARDENING-COMPLETE.md`
- `SECURITY.md` (docs/) — manter como visão geral, atualizar links

### 3.2 Criar `docs/security/README.md`
Índice navegável agrupado por camada (Edge Functions, Database, Identity & Access, Storage, HTTP/Edge), conforme template do prompt.

### 3.3 Atualizar referências
`rg "SECURITY-" docs/ AGENTS.md README.md src/` e atualizar links cruzados. Preservar referências em `mem://` apenas se fizer sentido.

## Lote 4 — Limpeza de comentários no código

### 4.1 Varredura
```bash
rg -ni "lovable" src/ supabase/functions/ --type-add 'code:*.{ts,tsx,js}' -tcode
```

### 4.2 Triagem por categoria
- **Apagar**: comentários autorais ("Lovable corrigiu...", "Implementado via Lovable AI", "TODO ajustar via Lovable")
- **Reescrever**: comentários com info técnica embutida no relato de processo → manter só a parte técnica + referência a migration/PR
- **Preservar**:
  - URLs reais (`ai.gateway.lovable.dev`, `bimaster.lovable.app`, `cdn.gpteng.co`)
  - `LOVABLE_API_KEY` (env var nome real)
  - Referências em `_shared/ai-gateway-call.ts` ao endpoint
  - Comentários em `cloudflare/wrangler.toml` que documentam o flow real

### 4.3 Não tocar
- `package.json` (manter `lovable-tagger`)
- `vite.config.ts` (plugin do tagger)
- `public/_headers` e CSP em `index.html` (manter `cdn.gpteng.co`)
- `cloudflare/worker.js` (manter `bimaster.lovable.app` como ORIGIN)
- `src/integrations/supabase/client.ts`, `types.ts`, `.env`, `supabase/config.toml`

## Critério de aceitação por lote

Cada lote: build limpo (harness automático), `bun run lint` verde, `bunx vitest run` verde, smoke E2E `scripts/security/e2e-anonymous-sensitive-columns.sh` verde.

Reporte final por lote: arquivos apagados/criados/movidos, diff line count nos docs principais, contagem `rg -c lovable` antes/depois com classificação das preservadas.

## Regras invioláveis (do prompt)

- Sem `git filter-repo` / rewrite
- Sem remover `lovable-tagger`, `cdn.gpteng.co`, `bimaster.lovable.app`, `ai.gateway.lovable.dev`
- Sem inventar histórico
- Sem alterar comportamento runtime — só comentários/docs/nomes/estrutura de docs

## Detalhes técnicos

- Renomeação em `docs/security/` é `git mv` simbólico via tool de rename (preservando histórico do GitHub)
- Após Lote 3, rodar `rg -l "docs/SECURITY-"` para garantir zero links quebrados
- Após Lote 4, rodar `rg -i "lovable" src/ supabase/functions/` e anexar a lista filtrada ao reporte (todas as matches restantes devem ser justificadas como "infra real")
- `AGENTS.md` atual já tem boa parte do conteúdo técnico — a edição é cirúrgica no tom, não rewrite
