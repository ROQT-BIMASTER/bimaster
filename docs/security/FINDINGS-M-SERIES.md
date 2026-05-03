# Triagem de findings M1 / M2 / M3

## M1 — Funções SQL sem `SET search_path` — RESOLVIDO (verificado em prod)

Auditoria contra o catálogo Postgres em produção:

```sql
SELECT count(*)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c
    WHERE c LIKE 'search_path=%'
  );
-- Resultado: 0
```

Todas as funções no schema `public` já têm `search_path` explícito. As migrations de Set–Out 2025 que o scanner sinalizava foram corrigidas em migrations posteriores. Nada a fazer.

**Como prevenir regressão**: toda nova função deve incluir `SET search_path = public` (ou outro valor explícito). Já é regra do AGENTS.md.

## M2 — `dangerouslySetInnerHTML` — SEGUROS, AÇÃO COSMÉTICA

Duas ocorrências identificadas, ambas sem risco de XSS:

| Arquivo | Conteúdo | Origem | Ação |
|---|---|---|---|
| `src/components/ui/chart.tsx` | Bloco `<style>` derivado de `ChartConfig` | Vendor shadcn/ui — `ChartConfig` é objeto definido pelo dev, nunca user input | Mantido + comentário `// SAFE: ...` |
| `src/components/whatsapp/WhatsAppAgentFlow.tsx` | Diagrama Mermaid 100% estático | String literal sem interpolação | Refatorado para JSX children (`<lov-mermaid>{...}</lov-mermaid>`) — sem `dangerouslySetInnerHTML` |

## M3 — `package-lock.json` versionado em projeto Bun — RESOLVIDO

Projeto usa Bun (`bun.lockb` é o lockfile oficial — AGENTS.md §1). `package-lock.json` (587 KB) foi removido e adicionado ao `.gitignore` junto com `yarn.lock` e `pnpm-lock.yaml` para evitar regressão.
