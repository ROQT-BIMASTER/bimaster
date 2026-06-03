# Plano de Melhorias — Módulo de Estoque

> Plano técnico priorizado. Foco: nivelar a qualidade do módulo, profissionalizar o
> design e corrigir problemas de performance/correção. Elaborado em 2026-06-02.

## Contexto: duas gerações de código

O módulo tem **duas gerações** convivendo:

- **Geração ERP (moderna, padrão-ouro):** `EstoqueVisaoGeral`, `EstoqueUnificadoPage`,
  `EstoqueAuditoriaDriftPage`. Tipagem forte, hooks dedicados (`useEstoqueQuery`,
  `useEstoqueKpis`), paginação/sort/busca **no servidor**, `KpiCard` reutilizável,
  `tabular-nums`, export Excel, debounce. Lê de `erp_estoque_distribuidora` / views.
- **Geração manual (legada):** `EstoqueModule` (hub), `EstoqueSaldos`, `EstoqueConsolidado`,
  `EstoqueDistribuidoras`, `EstoqueProdutosMaster`, `EstoqueVinculacoes`. Usa `any`,
  filtro/busca **client-side**, sem paginação, KPIs montados à mão. Lê das tabelas
  `estoque_*` manuais.

A maior parte do trabalho é **nivelar a legada pelo padrão da moderna** + cross-cutting
de design.

### Restrições do projeto (memória)
- PRs contra `main` sempre em **draft**.
- **Não** rodar `bun run build` / `bun run lint` (o harness Lovable compila no sync).
- Banco é administrado pelo **Lovable**: qualquer migration/RPC/índice é entregue como
  **PROMPT** para o usuário aplicar; não rodar SQL direto. Merge na main **não** aplica
  migrations — itens de banco exigem prompt + smoke test.

---

## FASE 0 — Correções rápidas (baixo risco, alto valor)

| # | Item | Arquivo | Tipo |
|---|------|---------|------|
| 0.1 | Corrigir link quebrado "Produtos Master" no command palette: path `/dashboard/estoque/produtos` → `/produtos-master`; `screenCode` `estoque_produtos` → `estoque_produtos_master` | `src/components/navigation/command-routes.ts:144` | FE |
| 0.2 | Hub: adicionar acesso a **Visão de Estoque**, **Unificado** e **Auditoria Drift** (hoje só no sidebar, invisíveis no painel) | `src/pages/modules/EstoqueModule.tsx` | FE |
| 0.3 | Remover/!substituir card "Inventário — Em breve" por algo real ou esconder | `EstoqueModule.tsx:66` | FE |

**Entrega:** 1 PR pequeno. Sem dependência de banco.

---

## FASE 1 — Performance & correção (crítico)

Problemas que **degradam com o crescimento de dados** — prioridade técnica máxima.

### 1.1 `EstoqueSaldos` — busca/paginação no servidor
- **Problema:** baixa TODOS os saldos e filtra a busca em JS (`EstoqueSaldos.tsx:62-68`);
  sem `.limit()` nem paginação. Trava conforme o estoque cresce.
- **Ação:** criar hook `useEstoqueSaldos({ busca, distribuidoraId, page, pageSize, sort })`
  em `src/hooks/estoque/`, com filtro via `.or(...ilike)` no servidor + `.range()`.
  Tipar a linha (`EstoqueSaldoRow`) — eliminar `any`.
- **Nota:** busca por nome/SKU do produto master exige filtro em tabela relacionada.
  Avaliar: (a) view `vw_estoque_saldos_detalhado` achatada (→ prompt Lovable) **ou**
  (b) RPC dedicada. Recomendado: **view** para reuso e simplicidade.

### 1.2 `EstoqueConsolidado` — filtro no servidor + memoização
- **Problema:** filtra a RPC inteira no cliente (`EstoqueConsolidado.tsx:42`); `maxQuantidade`
  recalcula `Math.max` a cada render (linha 70).
- **Ação:** passar `busca`/`categoria` como parâmetros da RPC
  `get_estoque_consolidado_por_produto_master` (→ prompt Lovable para alterar a função);
  `useMemo` para totais e `maxQuantidade`. Tipar retorno.

### 1.3 Eliminar `any` nas páginas legadas
- `EstoqueSaldos`, `EstoqueConsolidado`, `EstoqueDistribuidoras`, `EstoqueProdutosMaster`
  usam `any` em map/handlers. Tipar com os tipos gerados do Supabase
  (`src/integrations/supabase/types.ts`) ou tipos locais nos hooks.

**Dependências de banco (→ prompts Lovable):**
- View `vw_estoque_saldos_detalhado` (achata produto master + distribuidora + saldo).
- Parâmetros de busca/categoria na RPC do consolidado.
- Índices de apoio à busca (`ilike`) se necessário.

---

## FASE 2 — Consistência de design (maior ganho de percepção profissional)

### 2.1 Padronizar KPIs com `KpiCard`
- `EstoqueConsolidado` monta 3 `<Card>` à mão (`linhas 86-116`). Trocar por `KpiCard`
  (`src/components/ui/kpi-card.tsx`) com ícone + variante, igual à `EstoqueKpiBar`.
- `EstoqueSaldos` e `EstoqueProdutosMaster`/`Distribuidoras` ganham uma barra de KPIs
  no topo (total, ativos, alertas) usando `KpiCard`.

### 2.2 Componentes compartilhados de página
Criar primitivos reutilizáveis para acabar com as 3 variações de header/busca:
- `EstoquePageHeader` (título + ícone + descrição + ações) — padroniza `text-2xl`/`text-3xl`.
- `EstoqueSearchBar` (input com ícone + debounce embutido).
- `EstoqueEmptyState` (ícone + mensagem + CTA) — substitui os "Nenhum X encontrado" secos.

### 2.3 Polimento de tabelas
- `tabular-nums` em **toda** coluna numérica (legada não usa → números desalinham).
- Linhas clicáveis abrindo **drawer de detalhe** (padrão `EstoqueDetailDrawer` da ERP).
- Estados de loading com skeleton consistentes (já existe na ERP — replicar).

### 2.4 Tema/identidade
- Revisar uso de cores hardcoded (`text-blue-600`, `bg-orange-50`…) no hub vs tokens do
  tema (`primary`, `muted`, variantes do `KpiCard`). Migrar para tokens onde fizer sentido
  para dark mode consistente.

---

## FASE 3 — UX & funcionalidades faltando

### 3.1 Alertas de validade e estoque baixo (crítico p/ cosmética)
- Filtros "a vencer em 30/60/90 dias" e "vencidos" na tela de Saldos.
- Filtro/realce "estoque baixo" e "negativo" (faixas já existem em `estoqueFilters.ts` —
  reusar `classificarFaixa`).
- KPI dedicado de "lotes a vencer" no topo.

### 3.2 Export em todas as listagens
- Reusar padrão `EstoqueExportButton` (`utils/excelExport`) em Saldos, Consolidado,
  Produtos Master e Distribuidoras.

### 3.3 Empty states com CTA
- Primeira execução: "Nenhum produto cadastrado → [Cadastrar primeiro produto]".

### 3.4 Movimentações — histórico filtrável
- Aba "Movimentações" hoje fixa em 50 (`EstoqueSaldos.tsx:91`). Adicionar filtro por
  tipo/período/produto + paginação.

---

## FASE 4 — Profissionalização visual avançada (nice-to-have)

- KPIs com **tendência** (variação vs. período anterior / mini-sparkline).
- Curvas ABC com **legenda/tooltip** explicando classificação.
- **Modo densidade** (compacto/confortável) nas tabelas de alto volume.
- Gráfico de distribuição (top produtos por valor) no consolidado.
- Skeleton/shimmer mais refinado e microtransições.

---

## Ordem de execução sugerida (por PR)

1. **PR 1 — Fase 0** (correções rápidas, navegação). Sem banco.
2. **PR 2 — Fase 1.1/1.3** (Saldos server-side + tipagem). Precede prompt Lovable da view.
3. **PR 3 — Fase 1.2** (Consolidado server-side). Precede prompt Lovable da RPC.
4. **PR 4 — Fase 2** (design system do módulo: KpiCard, header/search/empty compartilhados).
5. **PR 5 — Fase 3** (validade/estoque baixo, export, empty states).
6. **PR 6 — Fase 4** (polimento avançado), conforme prioridade do negócio.

Cada PR contra `main` em **draft**. Itens de banco viram prompts Lovable separados,
aplicados antes do merge do PR correspondente + smoke test SQL.

---

## Resumo de dependências de banco (Lovable)

| Item | Mudança no banco |
|------|------------------|
| Fase 1.1 | View `vw_estoque_saldos_detalhado` (+ índices `ilike`) |
| Fase 1.2 | Parâmetros de busca/categoria em `get_estoque_consolidado_por_produto_master` |
| Fase 3.1 | (Opcional) índice em `data_validade` para filtros de vencimento |

Tudo o mais é **frontend puro** e não depende de migration.
