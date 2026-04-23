

# Plano — Calendário de Contas a Pagar carregando dados parciais

## Causa raiz

A query que alimenta o **Calendário de Vencimentos** baixa apenas os primeiros 1.000 títulos do ano e descarta o restante. Com 6.468 títulos só em 2026 (confirmado via `select count(*) from contas_pagar`), todo mês fora do "topo" da ordenação aparece vazio. No screenshot, abril carrega porque é o primeiro mês depois da ordenação, mas janeiro–março e maio–dezembro ficam em branco.

A paginação por cursor está quebrada em **dois pontos** que se reforçam:

### 1. Backend (`supabase/functions/_shared/contas-pagar/crud-handlers.ts`, linhas 162-216) — `handleQuery`
- Linha 176 (primeira página): ordena por `data_vencimento` (`order_by` default).
- Linha 174 (próximas páginas): faz `gt('id', cursor).order('id', ascending)` — muda o critério de ordenação no meio da paginação. Cursor por `id` UUID **não tem relação** com a ordem por `data_vencimento`, então pula linhas arbitrariamente.
- Linha 182: `nextCursor = p.cursor && data && data.length === p.limit ? ... : undefined`. **Só emite `nextCursor` se a requisição já trouxe cursor**. Resultado: a 1ª página nunca devolve cursor, o loop client-side encerra na primeira iteração.
- Linha 216 (`has_more`): também não considera o caso "primeira página com mais resultados via cursor", então o consumidor não tem como saber que existe mais dado.

### 2. Frontend (`src/pages/ContasAPagar.tsx`, linhas 249-270) — `fetchAllViaApi`
- Lê `res?.pagination?.cursor` e `res?.pagination?.has_more`. Como o backend não emite na 1ª página, o `while (safety < 200)` aborta após 1 iteração com 1.000 linhas.
- Não há fallback para paginação por `offset` quando o cursor está ausente.

Esse mesmo padrão alimenta também o **Dashboard** e a **Tabela** de contas a pagar quando há filtros multi-empresa/departamento/portador (linhas 273-355). Logo, sempre que o ano tem >1.000 títulos, todas as três visões ficam incompletas — o calendário só é mais visível porque mostra as 31 células do mês inteiro de uma vez.

Confirmação cruzada via logs: `function_edge_logs` mostra 37 OPTIONS para `/query` mas só 1 GET de fato — o restante das chamadas (que seriam as páginas 2+ no cursor) nunca são feitas porque o loop encerra antes.

## O que será feito

### 1. Corrigir o backend — `handleQuery` no `crud-handlers.ts`

Adotar **paginação por offset estável** (mais simples e suficiente para o volume atual; cursor por UUID em ordem `data_vencimento` não tem como ser correto). Mudanças:

- Remover o branch `if (p.cursor) { query.gt('id', p.cursor)... }`. A ordenação por `data_vencimento` precisa ser preservada para todas as páginas.
- Sempre paginar por `range(offset, offset + limit - 1)` com `order(p.order_by, p.order_dir)`.
- `pagination.has_more = (count || 0) > (offset + limit)` — único critério, simples e correto.
- Manter o campo `pagination.cursor` no payload mas sempre `null` (compatibilidade com clientes que ainda olham para ele); documentar deprecação no comentário.
- Manter `total`, `limit`, `offset` inalterados.

Isso preserva o contrato externo (não quebra `useContasPagar`, `PainelCentralAP`, etc.), apenas conserta o comportamento.

### 2. Corrigir o frontend — `fetchAllViaApi` em `src/pages/ContasAPagar.tsx`

- Trocar a paginação por `offset` incremental: `offset = 0`, depois `offset += PAGE` enquanto `has_more === true` ou enquanto `batch.length === PAGE`.
- Remover a leitura de `cursor`.
- Manter o limite de segurança (`safety < 200` → cobre até 200k linhas com `PAGE=1000`, suficiente).
- Log de debug opcional `console.debug` com total acumulado quando o loop termina, para facilitar diagnóstico futuro.

### 3. Calendário — separar a query do dashboard

Hoje a aba Calendário compartilha a mesma query do Dashboard quando o ano coincide. O calendário precisa do **ano inteiro** independentemente do `filterMes`. Já está separado (linhas 285-300) — apenas confirmar que `getDateRange` não é chamado nessa query (não é). Nenhum ajuste adicional aqui.

### 4. Verificação pós-correção

- Aba Calendário em 2026 deve mostrar títulos em todos os meses com `qtdTitulos` total batendo com `select count(*) from contas_pagar where extract(year from data_vencimento) = 2026` (≈6.468).
- Dashboard mensal sem filtro de mês deve carregar todas as 6.468 linhas.
- Tabela continua paginando server-side quando não há filtros client-side; quando há, baixa o conjunto completo.
- Conferir `function_edge_logs`: para um ano completo, devem aparecer ~7 GETs sequenciais a `/query` (6.468 / 1.000 ≈ 7 páginas) por carregamento.

## Detalhes técnicos

**Arquivos editados:**
- `supabase/functions/_shared/contas-pagar/crud-handlers.ts` — simplificar `handleQuery` (remover cursor, manter offset).
- `src/pages/ContasAPagar.tsx` — `fetchAllViaApi` migra para offset puro.

**Não será alterado:**
- Schema de resposta (`pagination.{total,limit,offset,has_more}`) permanece — apenas `cursor` vira sempre `null`.
- `useContasPagar`, `PainelCentralAP`, `ConciliacaoManualAP` e demais consumidores não precisam de mudança (não usavam `cursor`).
- `CalendarioVencimentos.tsx` é puramente apresentacional, não muda.

**Risco:** baixo. A paginação por offset com `order` estável é o padrão Supabase mais simples e não tem armadilhas. Volume atual (6.468/ano) cabe folgadamente em 7 requisições paralelizáveis.

**Changelog (mem://process/release-changelog-discipline):** registrar em `ApiDocumentation.tsx` um patch (`v4.4.3`) anotando o fix de paginação em `/query` com invariante grep negativo: `grep -n "p.cursor" supabase/functions/_shared/contas-pagar/crud-handlers.ts` deve retornar 0.

