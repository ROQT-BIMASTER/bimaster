## Diagnóstico

Projeto enorme e maduro: **466k linhas, 1.658 arquivos, 236 páginas, 215 hooks, 195 edge functions, 636 tabelas, 343 funções SECURITY DEFINER**. Arquitetura bem fundamentada (RLS coberta, lazy loading com retry, PWA, optimistic updates), mas há ineficiências sistêmicas e dívidas técnicas que pesam no dia a dia.

A análise abaixo está **priorizada por impacto/esforço**. Cada item tem evidência mensurável, justificativa e proposta concreta.

---

## Tier 1 — Alta prioridade (pegar primeiro)

### 1.1 — Bundle e startup time

- `App.tsx` tem **921 linhas, 276 lazy imports e 288 `<Route>`** em arquivo único. Isso é um único componente raiz com altíssima probabilidade de re-render em cascata.
- `manualChunks` no Vite só agrupa 3 vendors (react, supabase, 2 radix). 60+ pacotes radix, recharts, dnd-kit, fal-ai, três libs de PDF, etc., não são separados — ficam espalhados em chunks aleatórios.
- **Proposta**: dividir `App.tsx` em `routes/PublicRoutes.tsx`, `routes/DashboardRoutes.tsx`, `routes/TradeRoutes.tsx`, `routes/FinanceRoutes.tsx`, `routes/MarketingRoutes.tsx`, `routes/ProjetosRoutes.tsx`. Atualizar `manualChunks` com agrupamento por domínio (radix-ui, charts, dnd, pdf, ai). Esperado: -20% TTI no primeiro carregamento e App.tsx <250 linhas.

### 1.2 — `console.*` em produção (898 ocorrências)

- Existe `src/lib/logger.ts` mas só **19 arquivos o usam**. Os outros 360 espalham `console.log/error/warn` direto.
- `terserOptions.compress.drop_console = true` em produção mata os logs no build, mas:
  - Em dev a poluição é absurda (898 chamadas)
  - `console.error` legítimos para Sentry/observabilidade somem junto
- **Proposta**: codemod `console.X → logger.X` (script automatizado, ~1 hora de execução). Manter `console.error` apenas em `ErrorBoundary` e `lazyWithRetry`. Ganho: dev fica navegável e logger pode ser plugado a um sink (Sentry/Logtail) depois.

### 1.3 — `as any` epidêmico (4.182 ocorrências)

- 4.182 casts `as any` em código TS. Cada um é um buraco no type system. Os mais comuns são `(supabase as any).rpc(...)` porque o `types.ts` (39.575 linhas, atualizado pela CLI) não inclui RPCs criadas manualmente.
- **Proposta**:
  1. Criar `src/integrations/supabase/rpc.ts` com tipos manuais para as RPCs principais (`get_projeto_tarefas_v2`, `reorder_tarefas_secao`, `has_role`, `add_team_member_safe`, etc.).
  2. Wrapper tipado: `rpc<'get_projeto_tarefas_v2'>(...)` sem `as any`.
  3. Lint rule `@typescript-eslint/no-explicit-any` com baseline atual (não bloqueia CI hoje, só impede crescimento).
- Vai diminuir o número de bugs silenciosos por mudança de schema.

### 1.4 — Edge functions sem `secureHandler` (59 de 86)

- Apenas **27 das 86 edge functions** usam o wrapper `secureHandler` (padrão definido na memória). 59 ainda fazem auth/Zod/CORS manualmente — bug surface enorme.
- 24 funções usam `z.object({...})` sem `.strict()` (regra de memória) → permitem mass assignment.
- **Proposta**: refactor sistemático em batches de 10. Critério de aceite por função: `secureHandler` + Zod `.strict()` + sem `console.log` de payload + `corsHeaders` do SDK. Pode ser feito em 5-6 PRs independentes.

### 1.5 — `select("*")` em 597 lugares

- Buscar `*` força payloads grandes e quebra qualquer otimização de RLS por coluna. Em uma tabela com 30 colunas (vários casos), o cliente carrega ~10x do que usa.
- **Proposta**: lint custom + auditoria das 50 queries de páginas mais visitadas (Dashboard, ProjetoDetalhe, ContasAPagar, DetalhamentoVendas). Trocar por colunas explícitas. Pode reduzir 30-60% da resposta JSON em alta-frequência.

---

## Tier 2 — Média prioridade

### 2.1 — Cache strategy de React Query

- 167 hooks usam `useQuery`, mas **só 62 definem `staleTime`** (37%). O resto usa default = 0 → toda navegação dispara refetch.
- **Proposta**: criar `src/lib/queryClient.ts` com defaults globais sensatos (`staleTime: 30_000, gcTime: 5min`). Hooks específicos podem sobrescrever. Reduz drasticamente o tráfego percebido em SPAs com muita navegação.

### 2.2 — `invalidateQueries` em cadeia (472 chamadas)

- Padrão recorrente: após uma mutation, invalidar 3-4 queryKeys em sequência → 3-4 refetches paralelos contra o mesmo endpoint.
- **Proposta**: usar `predicate` quando possível (`invalidateQueries({ predicate: q => q.queryKey[0] === 'projeto-tarefas-v2' })`) e/ou `setQueryData` (já fazemos em Projetos). Auditoria nas 20 mutations mais quentes.

### 2.3 — Realtime ausente

- 0 uso de `supabase.channel(...)` no projeto. Em features colaborativas (Projetos, Trade, Inbox), ausência de realtime obriga refetch manual ou intervalo. Já há optimistic updates, mas dois usuários no mesmo projeto não veem mudanças um do outro.
- **Proposta** (opcional, decidir caso a caso): habilitar realtime em `projeto_tarefas`, `projeto_tarefa_comentarios`, `projeto_atividades` para refresh automático no Kanban/Lista.

### 2.4 — Arquivos gigantes (god components)

| Arquivo | Linhas |
|---|---|
| `SdkDownloadButtons.tsx` | 4.504 |
| `ApiDocumentation.tsx` | 3.875 |
| `DocumentacaoIntegracaoERP.tsx` | 3.489 |
| `DREAnalitico.tsx` | 2.185 |
| `ContasAPagar.tsx` | 1.838 |
| `FichaCustoProdutoEditor.tsx` | 1.749 |
| `LanguageContext.tsx` | 1.723 |
| `QuickEntryDialog.tsx` | 1.685 |
| `InfluencerProfile360.tsx` | 1.555 |
| `AppSidebar.tsx` | 1.544 |
| `StoreDetailDialog.tsx` | 1.406 |
| `ProjetoTarefaDetalhe.tsx` | 1.389 |

Todos acima de 1k linhas. São difíceis de testar, manter e renderizar (re-render cascade). **Proposta**: começar por `AppSidebar.tsx` (impacto em todo dashboard), `ContasAPagar.tsx` (página viva) e `ProjetoTarefaDetalhe.tsx` (módulo Projetos). Quebrar em sub-componentes + hooks.

### 2.5 — `LanguageContext.tsx` (1.723 linhas)

- Praticamente certeza de ser arquivo de tradução inline. Bloqueia o bundle inicial do dashboard (vai pra todo lugar).
- **Proposta**: mover traduções para JSONs por idioma em `/src/locales/{lang}.json` e carregar dinamicamente.

---

## Tier 3 — Higiene contínua

### 3.1 — TODO/FIXME/HACK (34 ocorrências)
Auditar e ou resolver ou virar issues no tracker.

### 3.2 — `window.location.reload` (5 lugares)
Verificar se algum pode virar invalidação suave de query em vez de reload completo (perde estado, perde scroll).

### 3.3 — Páginas duplicadas/órfãs (236 páginas)
Nem toda essa página é alcançável pelo router (288 routes mas alguns repetidos). Provavelmente há páginas órfãs após refactors. Script para detectar `pages/*.tsx` sem import em `App.tsx`.

### 3.4 — Dependências (81 deps de produção)
Auditar duplicidades: provavelmente há mais de uma lib de date, mais de uma de chart, mais de uma de PDF. Cada substituição reduz bundle.

### 3.5 — `staleTime` no `routePrefetch.ts`
O prefetch é por hover. Se o usuário hover-out rapidamente, a promise inflight ainda completa (correto), mas se ele depois navegar para outra rota o chunk fica residente. Já está OK; só seria útil instrumentar quanto isso ajuda na prática.

---

## Como executar

Sugestão de fases:

| Fase | Itens | Risco | Impacto |
|---|---|---|---|
| **A** (rápido, alto valor) | 1.2 (logger codemod), 2.1 (queryClient defaults), 1.4 batch 1 (10 edges) | baixo | alto |
| **B** | 1.1 (split App.tsx + manualChunks), 2.5 (i18n lazy) | médio | alto |
| **C** | 1.3 (rpc.ts tipado), 1.4 batches restantes | médio | alto |
| **D** | 2.4 (refactor god components, 1 por vez) | médio | médio |
| **E** | 1.5 (auditar select *), 2.2 (invalidate predicate), 2.3 (realtime), 3.x | baixo-médio | médio |

## Detalhes técnicos

- Codemods: usar `jscodeshift` ou simples `sed` com testes em PR isolado.
- Sem migration de banco no Tier 1 (banco está saudável: 0 tabela com RLS-on-sem-policy).
- Cada refactor de god component deve vir com smoke test manual antes de merge.
- Plan mode termina aqui — você decide quais fases atacar primeiro.

## Fora do escopo deste plano

- Adicionar testes (não há suíte atual robusta — discutir separado).
- Migrar para outro framework, server-side rendering ou monorepo.
- Refatorar o schema do banco (já está coerente).
