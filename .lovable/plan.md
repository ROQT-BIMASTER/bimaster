
# Plano: Central de Compras Internacionais + Compras Nacionais

## Contexto atual

Já existe em produção (fase 1 — base):
- `china_ordens_compra` (cabeçalho) + `china_ordem_itens` (saldo por SKU/cor: `qty_pedida`, `qty_produzida`, `qty_embarcada`, `qty_recebida`, `qty_cancelada`).
- `china_embarques` + `china_embarque_itens` (entregas parciais N:1 por OC).
- `china_recebimentos_carga` + `china_recebimento_itens`, `china_nao_conformidades`, `china_oc_saldo_decisoes`, `china_oc_custos`.
- Componentes: `ChinaOrdemItensPanel`, `EmbarqueParcialDialog`, `RecebimentoConferenciaDialog`, `SaldoOCDecisionDialog`.
- Rotas China sob `/dashboard/fabrica-china/*` no `AppSidebar`.

No Brasil:
- `fabrica_compras` (matérias-primas locais, status simples, **sem itens**, **sem saldo por item**, **sem vínculo a OP/OC China**).
- `fabrica_ordens_producao` (OP do Brasil) sem ligação com OC da China.
- Não existe rota/menu "Compras Brasil" nem "Central Internacional".

## Lacunas a resolver

1. **Não há tela consolidada Brasil** que mostre todas as OCs internacionais com saldo pendente (visão de comprador), pendências por status, KPIs de R$ pendente, atrasados, NCs abertas.
2. **Não há vínculo OC China ↔ OP/OC Brasil** (ex.: OC China envia 500 unidades de granel; isso vira insumo de uma OP Brasil; a OP brasileira só pode iniciar quando o saldo recebido cobre a necessidade).
3. **Compras Nacionais** (`fabrica_compras`) não tem itemização nem suporte a entregas parciais (mesmo problema do "1000 pedidas, 500 entregues, 500 pendentes").
4. **Sidebar**: não há entradas para "Central de Compras" nem "Compras Brasil".

---

## Fase 1 — DB: vínculo Brasil ↔ China e itemização de compras nacionais

Migrações SQL (uma por bloco lógico):

### 1.1 Vínculo OC China ↔ OP/Compra Brasil
```sql
create table public.compras_internacional_vinculos (
  id uuid pk default gen_random_uuid(),
  china_ordem_compra_id uuid not null references china_ordens_compra(id) on delete cascade,
  china_ordem_item_id  uuid references china_ordem_itens(id) on delete set null,
  -- destino no Brasil (qualquer um destes; pelo menos 1)
  fabrica_op_id        uuid references fabrica_ordens_producao(id) on delete set null,
  fabrica_compra_id    uuid references fabrica_compras(id) on delete set null,
  fabrica_mp_id        uuid references fabrica_materias_primas(id),
  qty_alocada          numeric not null default 0,
  observacoes          text,
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  check (fabrica_op_id is not null or fabrica_compra_id is not null or fabrica_mp_id is not null)
);
-- RLS: leitura para usuários com módulo china OU fabrica; escrita admin/supervisor.
```

### 1.2 Itemização e saldo de compras nacionais
```sql
create table public.fabrica_compra_itens (
  id uuid pk default gen_random_uuid(),
  compra_id uuid not null references fabrica_compras(id) on delete cascade,
  mp_id     uuid references fabrica_materias_primas(id),
  descricao text,
  qty_pedida    numeric not null default 0,
  qty_recebida  numeric not null default 0,
  qty_cancelada numeric not null default 0,
  preco_unitario numeric,
  status text not null default 'aberto', -- aberto|parcial|fechado|cancelado
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.fabrica_compra_recebimentos (
  id uuid pk default gen_random_uuid(),
  compra_id uuid not null references fabrica_compras(id) on delete cascade,
  numero_recebimento int not null default 1,
  data_recebimento date not null default current_date,
  nota_fiscal text,
  observacoes text,
  recebido_por uuid references auth.users(id),
  created_at timestamptz default now()
);

create table public.fabrica_compra_recebimento_itens (
  id uuid pk default gen_random_uuid(),
  recebimento_id uuid not null references fabrica_compra_recebimentos(id) on delete cascade,
  compra_item_id uuid not null references fabrica_compra_itens(id) on delete cascade,
  qty_recebida numeric not null,
  divergencia numeric default 0
);
```

Triggers:
- Ao inserir `fabrica_compra_recebimento_itens`: somar em `fabrica_compra_itens.qty_recebida`, recalcular status (`aberto`/`parcial`/`fechado`).
- Ao fechar todas as linhas: marcar `fabrica_compras.status = 'recebido_total'`.

### 1.3 View consolidada de saldos
```sql
create view public.v_compras_pendencias as
select
  'china' as origem, oc.id as oc_id, oc.numero_oc as numero,
  oi.id as item_id, oi.cor_nome as descricao,
  oi.qty_pedida, oi.qty_produzida, oi.qty_embarcada, oi.qty_recebida, oi.qty_cancelada,
  greatest(0, oi.qty_pedida - oi.qty_cancelada - oi.qty_recebida) as qty_pendente,
  oc.data_entrega_prevista, oc.status
from china_ordens_compra oc
join china_ordem_itens oi on oi.ordem_compra_id = oc.id
union all
select
  'brasil', c.id, coalesce(c.nota_fiscal, c.id::text),
  ci.id, coalesce(ci.descricao, mp.nome),
  ci.qty_pedida, null, null, ci.qty_recebida, ci.qty_cancelada,
  greatest(0, ci.qty_pedida - ci.qty_cancelada - ci.qty_recebida),
  c.data_entrega_prevista, c.status
from fabrica_compras c
join fabrica_compra_itens ci on ci.compra_id = c.id
left join fabrica_materias_primas mp on mp.id = ci.mp_id;
```

---

## Fase 2 — Hooks

- `useComprasInternacionalVinculos(ocId?)` — lista/cria vínculo OC↔OP/Compra/MP.
- `useComprasPendencias(filtros)` — KPIs e listagem usando `v_compras_pendencias`.
- `useFabricaCompraItens(compraId?)` — CRUD de itens de compra nacional.
- `useFabricaCompraRecebimentos(compraId?)` + `useRegistrarRecebimentoCompra()`.

---

## Fase 3 — UI: Central de Compras Internacionais (Brasil)

Nova rota `/dashboard/compras-internacionais`. Página `ComprasInternacionais.tsx` usando `ChinaPageShell` (mantém sidebar + color picker).

Conteúdo:
- **KPIs**: OCs em aberto, Qtd. pendente total, R$ pendente (US$→BRL), OCs atrasadas, NCs abertas.
- **Abas**:
  1. *Pendências por SKU* — tabela vinda de `v_compras_pendencias` (origem China), filtros por OC, fornecedor, status, atrasadas.
  2. *Embarques em trânsito* — `china_embarques` ainda não recebidos; ETA, container, navio.
  3. *Recebimentos a conferir* — recebimentos físicos abertos.
  4. *Não conformidades* — lista de `china_nao_conformidades` com chat bilateral.
  5. *Decisões de saldo* — log de `china_oc_saldo_decisoes` com ação rápida (`SaldoOCDecisionDialog`).
- **Drawer "Vincular ao Brasil"** em cada item: cria `compras_internacional_vinculos` apontando para uma OP do Brasil, uma compra de MP ou uma MP livre, com `qty_alocada`.

Rota `/dashboard/compras-internacionais/oc/:id` → reaproveita `ChinaOrdemDetalhe` com aba extra "Vínculos Brasil".

---

## Fase 4 — UI: Central de Compras Nacionais (Brasil)

Refatorar `FabricaCompras` (ou criar `ComprasNacionais.tsx`) com a mesma estética:
- Lista de `fabrica_compras` com saldo por item (badge `parcial`/`pendente`/`fechado`), barra lateral colorida por status.
- Detalhe da compra com abas: Itens (saldo), Recebimentos parciais (`RegistrarRecebimentoNacionalDialog`), Documentos/NF, Vínculos com China (se houver).
- KPIs no topo.

---

## Fase 5 — Sidebar e navegação

Em `src/components/dashboard/AppSidebar.tsx`, adicionar novo grupo **Compras 采购** (ou itens dentro de Fábrica/China):
```
Compras
  └ Central Internacional   /dashboard/compras-internacionais
  └ Compras Nacionais       /dashboard/compras-nacionais
  └ Pendências (saldo)      /dashboard/compras-internacionais?aba=pendencias
```
Adicionar rotas correspondentes em `src/App.tsx` com `lazyWithRetry` e `ScreenProtectedRoute`.

---

## Fase 6 — Fluxo "OC China → OP Brasil" com saldo

Em `FabricaOrdensProducao` (lista/detalhe) e em `ChinaOrdemItensPanel`:
- Botão **"Vincular OP Brasil"** abre `VincularOPBrasilDialog` que cria um `compras_internacional_vinculos` e mostra:
  - Saldo recebido disponível para alocação (qty_recebida − Σ qty_alocada).
  - Quanto a OP Brasil ainda precisa.
- Indicador "Aguardando insumo China" na OP quando saldo alocado < quantidade planejada.

---

## Entregáveis por fase

| Fase | Entregável | Arquivos principais |
|---|---|---|
| 1 | Migração SQL (3 tabelas + view + triggers) | `supabase/migrations/...sql` |
| 2 | Hooks de dados | `src/hooks/useComprasPendencias.ts`, `useFabricaCompraItens.ts`, `useFabricaCompraRecebimentos.ts`, `useComprasInternacionalVinculos.ts` |
| 3 | Central Internacional | `src/pages/ComprasInternacionais.tsx`, `src/components/compras/VincularBrasilDialog.tsx` |
| 4 | Central Nacional | `src/pages/ComprasNacionais.tsx`, `src/components/compras/CompraNacionalDetalhe.tsx`, `RegistrarRecebimentoNacionalDialog.tsx` |
| 5 | Sidebar + rotas | `src/components/dashboard/AppSidebar.tsx`, `src/App.tsx` |
| 6 | Vínculo OP Brasil ↔ saldo China | `src/components/fabrica/VincularOPBrasilDialog.tsx`, ajustes em `FabricaOrdensProducao.tsx` e `ChinaOrdemItensPanel.tsx` |

---

## Premissas / decisões já tomadas (mantidas)

- Visual: `ChinaPageShell` (sidebar + color picker idêntico a Projetos), `KpiCard`, `EmptyState`, barras laterais por status, `BilingualLabel` quando aplicável.
- Segurança: RLS restrita a usuários com módulo `china` ou `fabrica`; escrita só admin/supervisor.
- Saldo é sempre `qty_pedida − qty_cancelada − qty_recebida` (server-side via view + trigger).
- Entregas parciais reaproveitam `china_embarques` (China) e novo `fabrica_compra_recebimentos` (Brasil); ambos N:1 por compra/OC.
- Nenhuma alteração em tabelas reservadas (`auth`, `storage`, etc.) e nenhum CHECK temporal — usar triggers para validação.

## Pontos de confirmação

1. Posso criar **um novo grupo "Compras 采购"** no sidebar (ao invés de embutir nos grupos Fábrica/China)?
2. Vínculo Brasil deve permitir alocar saldo da OC China **direto a uma `fabrica_materia_prima`** (estoque) além de OP/Compra, ou só a OP/Compra?
3. Para Compras Nacionais, devo **migrar dados existentes** de `fabrica_compras` (1 linha = 1 item) para a nova `fabrica_compra_itens` automaticamente?
