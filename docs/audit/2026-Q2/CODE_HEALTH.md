# CODE_HEALTH — Auditoria 2026-Q2

> **Status:** descritivo (PR-2). Nenhum refactor executado.
> **Data da coleta:** junho/2026, branch `docs/audit-architecture-and-modules`.
> **Escopo:** `src/**` (exclui `src/integrations/supabase/types.ts`, auto-gerado).
> **Módulo Projetos:** auditado, **não editado** (regra do ciclo).

---

## 1. Resumo executivo (semáforo)

| Dimensão | Status | Indicador-chave |
| --- | --- | --- |
| TypeScript strictness | 🔴 Crítico | `tsconfig.json` desabilita `noImplicitAny` e `strictNullChecks` |
| Uso de `any` | 🔴 Crítico | ~6.369 ocorrências em ~1.145 arquivos |
| God-files (>800 LoC) | 🟠 Alto | 76 arquivos; 13 acima de 1.500 LoC |
| Cobertura de testes | 🟠 Alto | 54 arquivos `*.test.ts(x)` para 235 páginas |
| `@ts-ignore` / `@ts-expect-error` | 🟢 Baixo | 7 ocorrências em 7 arquivos |
| `console.*` em produção | 🟢 Baixo | 31 ocorrências em 19 arquivos |
| TODO / FIXME / HACK | 🟢 Baixo | 47 ocorrências em 29 arquivos |
| Migrations | 🟡 Médio | 1.489 arquivos em `supabase/migrations/` — falta sumarização |
| Workflows CI | 🟢 OK | 13 workflows ativos (lint, build, typecheck, RLS E2E, regression) |

---

## 2. Métricas globais

| Métrica | Valor |
| --- | ---: |
| Páginas (`src/pages/**/*.tsx`) | 341 |
| Páginas no nível raiz (`src/pages/*.tsx`) | 235 |
| Diretórios de componentes (`src/components/*/`) | 66 |
| Hooks (`src/hooks/*`) | 338 |
| Contexts (`src/contexts/*`) | 9 |
| Rotas declaradas em `App.tsx` | 357 |
| Edge functions (excluindo `_shared`) | 274 |
| Migrations em `supabase/migrations/` | 1.489 |
| Arquivos de teste (`*.test.ts(x)`) | 54 |
| Workflows GitHub Actions | 13 |

Top-10 maiores arquivos (LoC, ignorando `types.ts` auto-gerado):

| LoC | Arquivo |
| ---: | --- |
| 4.180 | `src/components/erp/ApiDocumentation.tsx` |
| 3.488 | `src/components/configuracoes/DocumentacaoIntegracaoERP.tsx` |
| 2.185 | `src/pages/DREAnalitico.tsx` |
| 1.997 | `src/components/china/ChinaChecklistFocusMode.tsx` |
| 1.943 | `src/components/projetos/ProjetoTarefaDetalhe.tsx` *(read-only)* |
| 1.845 | `src/pages/FabricaProdutosAcabados.tsx` |
| 1.840 | `src/pages/ContasAPagar.tsx` |
| 1.788 | `src/components/fabrica/FichaCustoProdutoEditor.tsx` |
| 1.686 | `src/components/trade/QuickEntryDialog.tsx` |
| 1.680 | `src/pages/financeiro/RelatorioConsolidadoPlanoReducao.tsx` |

Distribuição de god-files:

| Faixa LoC | Arquivos |
| --- | ---: |
| > 1.500 | 13 |
| 1.001–1.500 | 29 |
| 801–1.000 | 34 |
| **Total > 800** | **76** |

---

## 3. Achados

### 3.1 🔴 [CRÍTICO] TypeScript não está em strict mode

`tsconfig.json` desativa explicitamente os principais flags de segurança:

```json
{
  "compilerOptions": {
    "allowJs": true,
    "noImplicitAny": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "strictNullChecks": false
  }
}
```

**Impacto:** o compilador não bloqueia `any` implícito nem acesso a `null/undefined`, o que explica diretamente o achado 3.2 e contribui para defeitos em runtime que só aparecem em produção.

**Recomendação (PR futuro, fora deste ciclo de auditoria):**
1. Criar `tsconfig.strict.json` em modo *check-only* (não acoplado ao build) ligando `strict: true`, e usar baseline (`tsc --noEmit`) para fixar o número atual de erros e impedir regressão.
2. Plano de migração por módulo (preferência: módulos com menor superfície primeiro — `qa/`, `meetings/`, `tour/`).

### 3.2 🔴 [CRÍTICO] Uso intensivo de `any`

~6.369 ocorrências de `: any`, `<any>` e `as any` em ~1.145 arquivos. Os maiores ofensores se sobrepõem aos god-files do achado 3.3.

**Causas prováveis:**
- `tsconfig` permissivo (3.1) → IDE não pressiona;
- Tipos retornados por `supabase-js` quando há joins dinâmicos;
- Wrappers de IA que retornam payload livre.

**Recomendação:**
- Após habilitar strict (3.1), criar helpers tipados para queries Supabase recorrentes em `src/lib/db/`;
- Tipar respostas de Edge Functions via Zod no front (já existe padrão em `src/lib/validations/`).

### 3.3 🟠 [ALTO] God-files

76 arquivos acima de 800 LoC. Os 13 maiores concentram funções de orquestração (renderização + estado + chamadas de rede + lógica de negócio) em um único componente.

**Notas:**
- `ApiDocumentation.tsx` (4.180) e `DocumentacaoIntegracaoERP.tsx` (3.488) são predominantemente conteúdo estático (documentação em JSX); candidatos a externalizar para MDX/JSON.
- `ProjetoTarefaDetalhe.tsx` e `MinhasTarefasContent.tsx` estão no módulo **Projetos** — auditados, **não editados** neste ciclo (ver `mem://features/projects/...`).
- `DREAnalitico.tsx`, `ContasAPagar.tsx`, `RelatorioConsolidadoPlanoReducao.tsx`, `FichaCustoProdutoEditor.tsx` são candidatos prioritários a decomposição em sub-componentes + hooks.

**Recomendação:** não refatorar neste ciclo. Tratar como backlog priorizado no PR-5 (relatório executivo) com critério: maiores LoC × frequência de mudança em `git log`.

### 3.4 🟠 [ALTO] Cobertura de testes baixa

54 arquivos de teste (vitest + Testing Library) para 235 páginas raiz e 274 edge functions. Os testes presentes concentram-se em utilitários puros (`src/lib/**`) e em hooks isolados; quase não há testes de integração de páginas.

**Recomendação:** definir alvo mínimo por módulo crítico (Financeiro, Fábrica, Projetos) — meta de 1 teste de fluxo principal por página de mutação. Não é entrega deste ciclo; entra no roadmap (PR-5).

### 3.5 🟡 [MÉDIO] Volume de migrations sem sumarização

1.489 arquivos em `supabase/migrations/`. Não há índice/CHANGELOG de schema; investigar deltas exige `git log` artesanal.

**Recomendação:** PR-3 cobre a geração de `DATABASE.md` consolidado; PR-4 prevê script `scripts/audit/generate-db-doc.ts` para automatizar.

### 3.6 🟡 [MÉDIO] Volume de hooks

338 hooks em `src/hooks/`. Inspeção amostral indica duplicação (vários `use<Recurso>Mutations`, `use<Recurso>Data`, etc.). Não compromete funcionamento, mas dificulta descoberta.

**Recomendação:** inventário automatizado em PR-4 (`scripts/audit/list-hooks.ts`) classificando por domínio.

### 3.7 🟢 [BAIXO] `@ts-ignore` / `@ts-expect-error`

7 ocorrências em 7 arquivos — volume saudável. Preferência por `@ts-expect-error` (falha quando o erro suprimido some) deve ser política do PR-4.

### 3.8 🟢 [BAIXO] `console.*` em código de produção

31 ocorrências em 19 arquivos. Baixo, mas deve haver lint-rule (`no-console` com exceção para `console.error`) no PR-1.5 ou PR-4.

### 3.9 🟢 [BAIXO] TODO / FIXME / HACK

47 marcadores em 29 arquivos. Volume aceitável; recomenda-se converter em issues do GitHub via script no PR-4.

---

## 4. Pontos fortes

- **Arquitetura de providers limpa e documentada** (9 contexts, ordem explícita em `src/App.tsx`).
- **Padrão de Edge Function consistente** (`secureHandler` + `callAIGateway` + Zod `.strict()` — ver AGENTS.md §7).
- **CI já robusto** para um repo do porte: 13 workflows incluindo CodeQL (PR-1), dependency-review (PR-1), regression-greps, RLS E2E.
- **Tokens de design HSL semânticos** disciplinadamente aplicados (memória `mem://design/...`).
- **Memórias persistentes** (`mem://index.md`) substituem grande parte do conhecimento tribal — vantagem clara sobre projetos comparáveis.

---

## 5. Itens deliberadamente fora deste PR

- Habilitar `strict` em `tsconfig` (PR de refactor, fora do ciclo de auditoria).
- Decompor god-files (fora do ciclo; backlog priorizado no PR-5).
- Adicionar testes (entra no roadmap do PR-5).
- Qualquer alteração no módulo **Projetos** (restrição do ciclo).
- Mover arquivos / renomear diretórios.

---

## 6. Como reproduzir as métricas

```bash
# Páginas
find src/pages -name '*.tsx' | wc -l

# Componentes / hooks / contexts
ls -d src/components/*/ | wc -l
ls src/hooks | wc -l
ls src/contexts | wc -l

# Rotas
rg -c '<Route ' src/App.tsx

# Edge functions
ls supabase/functions | grep -v '^_' | wc -l

# God-files > 800 LoC
find src -name '*.tsx' -o -name '*.ts' | grep -v supabase/types \
  | xargs wc -l | awk '$1>800 && $2!="total"' | sort -rn

# Uso de any
rg -g '*.ts' -g '*.tsx' ': any\b|<any>|as any\b' src -c \
  | awk -F: '{s+=$2; n++} END{print s" hits in "n" files"}'

# TODO/FIXME
rg -g '*.ts' -g '*.tsx' 'TODO|FIXME|HACK|XXX' src -c \
  | awk -F: '{s+=$2; n++} END{print s" hits in "n" files"}'

# @ts-ignore
rg -g '*.ts' -g '*.tsx' '@ts-ignore|@ts-nocheck|@ts-expect-error' src -c

# Migrations
ls supabase/migrations | wc -l
```

O PR-4 (`chore/audit-doc-automation`) consolidará esses comandos em `scripts/audit/*` e os emitirá como artefato versionado para detectar drift via workflow.
