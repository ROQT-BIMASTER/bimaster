# Style Guide — Bi Master

Padrão oficial de código do projeto. **Toda nova contribuição** deve seguir este
guia. Código existente fora do padrão será migrado **gradualmente, por módulo**,
quando houver oportunidade — sem refactor em massa.

> Complementa [`AGENTS.md`](../AGENTS.md) (regras invioláveis para humanos e agentes
> de IA) e [`CONTRIBUTING.md`](../CONTRIBUTING.md) (fluxo de PR, branches, commits).

## Idioma por camada

| Camada | Idioma | Exemplos |
|---|---|---|
| **Entities & Types de domínio** | PT | `Cliente`, `ContaPagar`, `Projeto`, `OrdemCompra` |
| **Hooks de domínio** | PT | `useClientes`, `useProjetos`, `useContasPagar` |
| **Componentes UI de domínio** | PT | `<NovaContaDialog>`, `<ListaClientes>` |
| **Páginas (rotas)** | PT | `Financeiro.tsx`, `ContasAPagar.tsx` |
| **Helpers/utils genéricos** | EN | `formatDate`, `parseLocalDate`, `debounce`, `clamp` |
| **Hooks utilitários** | EN | `useDebounce`, `useLocalStorage`, `useMediaQuery` |
| **Componentes UI genéricos** | EN | `<DataTable>`, `<Modal>`, `<Skeleton>` (já em EN via shadcn) |
| **Comentários** | PT | Audience é o time Bi Master |
| **Commit messages** | PT body | Prefixo `feat:`/`fix:`/`chore:` em EN (Conventional Commits) |
| **Strings de UI visíveis** | PT | (texto que aparece para o usuário final) |
| **DB columns** | snake_case | `created_at`, `empresa_id`, `data_vencimento` |

### Princípio guia

**Domínio reflete o negócio (PT). Infra reflete a stack (EN).**

Em caso de dúvida: se a função/tipo aparece numa conversa entre dev e analista de
negócio, é domínio → **PT**. Se só dev fala dela, é infra → **EN**.

## Naming conventions

| Tipo | Convenção | Exemplo |
|---|---|---|
| Variáveis e funções | `camelCase` | `clienteSelecionado`, `calcularTotal()` |
| Componentes React | `PascalCase` | `ListaClientes`, `NovaContaDialog` |
| Types e Interfaces | `PascalCase` | `Cliente`, `ContaPagar`, `ApiResponse` |
| Constantes globais | `UPPER_SNAKE_CASE` | `DEFAULT_PAGE_SIZE`, `MAX_RETRY` |
| Arquivos de páginas/components | `PascalCase` | `Financeiro.tsx`, `DataTable.tsx` |
| Arquivos de hooks/utils | `camelCase` | `useDebounce.ts`, `formatDate.ts` |
| Arquivos de config/lib | `kebab-case` | `query-client.ts`, `secure-handler.ts` |
| DB columns | `snake_case` | `data_vencimento`, `valor_total` |
| Edge Function folders | `kebab-case` | `contas-pagar-api/`, `admin-reset-password/` |
| Env vars | `UPPER_SNAKE_CASE` | `SUPABASE_URL`, `LOVABLE_API_KEY` |

**Não migrar arquivos existentes** apenas por convenção — só seguir em arquivos
novos. Migração em massa quebra imports e histórico do git.

## Estrutura de comentários

```ts
/**
 * Calcula valor total de uma lista de contas a pagar.
 *
 * Inclui juros e multa se data_vencimento < hoje.
 *
 * @param contas Lista de contas a pagar
 * @param dataReferencia Data para cálculo de juros (default: hoje)
 * @returns Valor total em centavos
 */
export function calcularTotalContasPagar(/* ... */) { /* ... */ }
```

- JSDoc apenas em funções **exportadas e públicas** ou que precisam de contexto
- Comentários inline em PT, frase curta
- **Não** comentar o óbvio (`// incrementa i` numa linha `i++`)
- **Não** atribuir autoria em comentário (`// João corrigiu isso`) — `git blame` faz isso

## Imports order

```ts
// 1. React e libs externas
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

// 2. Imports do projeto via @/ (ordem alfabética)
import { Button } from "@/components/ui/button";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { logger } from "@/lib/logger";

// 3. Imports relativos (ordem alfabética)
import { ClienteCard } from "./ClienteCard";
import type { Cliente } from "./types";
```

ESLint pode ordenar automaticamente via `eslint-plugin-import` (não obrigatório
agora — mantém configuração existente).

## Logging

Sempre via `import { logger } from "@/lib/logger"`. **Nunca** `console.*` em
código de produção (`logger.ts` é a única exceção legítima — emissor central).

```ts
logger.debug("contexto interno");                    // info para dev, suprimido em prod
logger.info("evento de domínio");                    // log estruturado
logger.warn("anomalia recuperável");
logger.error("erro que precisa investigação", { error });
```

ESLint sinaliza `console.*` como warning (`no-console`).

## Error handling

- Funções que podem falhar **retornam Result** ou **lançam Error tipado**
- Edge Functions usam `errorResponse(status, code, message, req, startMs)` —
  ver `supabase/functions/_shared/response.ts`
- Frontend captura erros em **boundaries** (`<ErrorBoundary>`) ou em `try/catch`
  com `logger.error` + `toast` de feedback ao usuário

## TypeScript strict

- `any` proibido em código novo (use `unknown` + narrowing, ou tipo explícito)
- `as` cast aceitável apenas em casos justificados, com comentário explicando
- Zod `.strict()` para validar input externo (Edge Functions, forms)
- Sem `// @ts-ignore` — usar `// @ts-expect-error` com comentário (gate ESLint
  ativo)

## Commits

```
feat(financeiro): adiciona projeção DRE 12 meses
fix(trade): corrige duplicidade de CNPJ no cadastro
chore(deps): atualiza zod para 3.25
docs(security): consolida índice em docs/security/
refactor(china): extrai utility de naming de canal Realtime
test(api): adiciona smoke test de e2e RLS
```

Tipo (em EN, Conventional Commits): `feat`, `fix`, `chore`, `docs`, `refactor`,
`test`, `perf`, `build`, `ci`. Mensagem em PT, imperativo, máximo 72 chars na
primeira linha.

## Quando o padrão é violado

- Em **PR review**: reviewer aponta, contribuidor ajusta
- Em **código existente**: aceito como dívida; migrar quando houver oportunidade
  (mesmo módulo já sendo refatorado por outra razão)
- Em **código novo**: sem exceção — gates ESLint (`no-console`,
  `no-explicit-any`, `ban-ts-comment`) sinalizam regressão automaticamente
