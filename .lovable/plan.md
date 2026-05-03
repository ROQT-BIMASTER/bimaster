# Finalizar profissionalização do repositório

## Estado atual (verificado)

A maior parte já foi feita em iterações anteriores. Pendências reais:

- `AI_CONTEXT.md` (364 linhas) ainda na raiz — referenciado por `AGENTS.md` como "system prompt portátil"
- `docs/SECURITY.md` (159 linhas, antigo) coexiste com `docs/security/README.md` (índice novo)
- `.github/ISSUE_TEMPLATE/` não existe (bug.md / feature.md)
- ~97 ocorrências de "lovable" em `src/` e `supabase/functions/` fora das categorias infra (URL gateway, tagger, gpteng CDN, hosting origin, env var)
- Os 11 `docs/PROMPT-LOVABLE-*.md` já foram apagados
- LICENSE, CONTRIBUTING.md, SECURITY.md, CHANGELOG.md, PR template, CODEOWNERS já existem
- 14 docs `SECURITY-*.md` já consolidados em `docs/security/`
- `docs/INFRASTRUCTURE.md` (528 linhas) já existe e cobre o exigido

## Mudanças

### 1. AI_CONTEXT.md — manter (decisão divergente do prompt)

`AGENTS.md` referencia explicitamente `AI_CONTEXT.md` como o system prompt
portátil para IAs externas (Cursor, Claude Code, etc.). Apagar quebra essa
funcionalidade. Em vez disso: **manter** e apenas remover qualquer atribuição
cosmética ("Lovable corrigiu") se houver.

Se o usuário insistir em apagar, faço em follow-up — mas o plano default
preserva. Se preferirem apagar agora, dizer "apaga AI_CONTEXT.md".

### 2. Resolver duplicação `docs/SECURITY.md`

`docs/SECURITY.md` (status técnico, score 100/100) e `docs/security/README.md`
(índice navegável) têm propósitos diferentes mas títulos colidentes.

Ação: renomear `docs/SECURITY.md` → `docs/security/STATUS.md` (status report
operacional) e adicionar link a partir do `docs/security/README.md`.

### 3. Criar `.github/ISSUE_TEMPLATE/bug.md` e `feature.md`

Conforme texto fornecido no prompt (em PT-BR).

### 4. Limpeza de comentários "Lovable" no código

Triagem das ~97 linhas restantes em `src/` e `supabase/functions/`:

- **Apagar** comentários autorais ("Lovable AI corrigiu...", "Implementado via
  Lovable", "// Lovable: ...")
- **Reescrever** quando há informação técnica ("Lovable AI corrigiu cross-tenant"
  → "Cross-tenant fix: empresa_id obrigatório no INSERT")
- **Preservar**: `LOVABLE_API_KEY`, `ai.gateway.lovable.dev`, `lovable-tagger`,
  `cdn.gpteng.co`, `bimaster.lovable.app`

Comando de triagem:
```bash
grep -rn -i "lovable" src/ supabase/functions/ \
  --include="*.ts" --include="*.tsx" \
  | grep -vE "ai\.gateway\.lovable\.dev|lovable-tagger|cdn\.gpteng\.co|bimaster\.lovable\.app|LOVABLE_API_KEY"
```

### 5. Atualizar referências cruzadas

Substituir `docs/SECURITY.md` → `docs/security/STATUS.md` em:
- `AGENTS.md`
- `docs/onboarding/00-INDEX.md`
- `docs/security/HEADERS.md`
- `docs/security/RLS-AUDIT.md`
- `src/components/erp/ApiDocumentation.tsx`
- `src/lib/version.ts`

### 6. Validação final

- Build/lint/tests rodam pelo harness
- `bash scripts/security/e2e-authenticated-sensitive-columns.sh`
- Confirmar `grep` filtrado retorna 0 (ou só matches justificadas)

## Não vou fazer

- Apagar `AI_CONTEXT.md` (decisão acima — pode reverter sob demanda)
- Mexer em `package.json`, `_headers`, `worker.js`, `_shared/ai-gateway-call.ts`
- Reescrever git history
- Criar/recriar arquivos que já existem (LICENSE, CONTRIBUTING, etc.)

## Reporte final

- Lista de comentários reescritos/apagados (antes: 97 → depois: alvo <10
  justificadas)
- Confirmação de cada item do critério de aceitação
