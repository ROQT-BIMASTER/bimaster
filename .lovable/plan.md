

## Plan: Enhance "Contas a Pagar" Tab + Detail Page

### Scope
1. **Replace the content of the "contas" tab** (lines ~1310-1619 in ContasAPagar.tsx) with an upgraded version
2. **Create a new detail page** at `/dashboard/financeiro/contas-a-pagar/:id`
3. **Create the `fn_criar_titulo_com_parcelas` RPC** (does not exist yet)

### What stays untouched
- Header, KPIs, global filters, all other tabs (Dashboard, Calendario, Orcamentos, Classificacao IA, DRE, Comunicacao, Central de Pagamentos)
- Top buttons (Modulo Financeiro, Plano de Contas, Sincronizacao ERP, Auditoria IA)

---

### Step 1: Database - Create RPC `fn_criar_titulo_com_parcelas`

SQL function that:
- Receives title fields (fornecedor_nome, fornecedor_codigo, tipo_documento, numero_documento, descricao, data_emissao, data_vencimento, valor_original, empresa_id, numero_parcelas, etc.)
- Inserts into `contas_pagar` with `total_parcelas`, `numero_parcela = 1`, generates `erp_id` as UUID
- If `numero_parcelas > 1`, generates rows in `parcelas` table with evenly split values and monthly due dates
- Returns the new `contas_pagar.id`

### Step 2: Extract "Contas a Pagar" tab into a component

Create `src/components/financeiro/ContasPagarTabContent.tsx`:

- **"+ Novo Titulo" button** top-right of the tab area
- **Search bar**: text search on fornecedor/documento/descricao + status filter (Todos/Pendente/Parcial/Pago/Cancelado/Vencido) + date range pickers (De/Ate for data_vencimento) + "Limpar" button
- **Paginated table** (20/page) querying `contas_pagar` directly with columns: Fornecedor, Documento, Descricao, Vencimento (red text if vencido), Valor Original, Valor Pago, Saldo (valor_aberto), Status (colored badge), Parcelas (numero_parcela/total_parcelas), Actions (Eye -> navigate to detail, Pencil -> edit drawer, X -> cancel with confirmation)
- **Drawer (600px)** for create/edit with fields: fornecedor (autocomplete from `fornecedores` table), tipo_documento, numero_documento, descricao, data_emissao, data_vencimento, valor_original, valor_desconto, valor_juros, valor_ajustes, valor_liquido (auto-calculated: original - desconto + juros + ajustes), numero_parcelas (1-12 select), conta_bancaria_id (select from `contas_bancarias`), categoria_nome, centro_custo (select from `centros_custo`), observacoes
- On create with parcelas > 1: call RPC `fn_criar_titulo_com_parcelas`
- On create with 1 parcela: direct INSERT into `contas_pagar`
- On edit: UPDATE `contas_pagar`

Props will receive the existing global filter state and query invalidation function from the parent.

### Step 3: Create detail page `src/pages/ContaPagarDetalhe.tsx`

Route: `/dashboard/financeiro/contas-a-pagar/:id`

Two-column layout:
- **Left column**: Card with full title data (fornecedor, documento, emissao, vencimento, valores, status, portador, categoria, departamento, plano de contas, observacoes)
- **Right column**: 
  - Card listing parcelas from `parcelas` table (where `conta_pagar_id = id`) with numero_parcela, valor, data_vencimento, status badge, and "Pagar" button per parcela
  - Card listing payment history from `pagamentos` table (where `conta_pagar_id = id`)
  - "Registrar Pagamento" modal: valor, data_pagamento (default today), forma_pagamento select (PIX/TED/DOC/boleto/cheque/dinheiro/cartao), conta_bancaria_id select, observacoes
  - On save payment: INSERT into `pagamentos`, UPDATE parcela status to 'pago', recalculate `contas_pagar.valor_aberto` and `valor_pago`, update status via existing trigger logic

### Step 4: Update ContasAPagar.tsx

Replace the `TabsContent value="contas"` block (lines ~1310-1619) with the new `<ContasPagarTabContent />` component, passing necessary props.

### Step 5: Update App.tsx

Add route:
```tsx
<Route path="/dashboard/financeiro/contas-a-pagar/:id" element={<ScreenRoute screenCode="financeiro_contas_pagar"><ContaPagarDetalhe /></ScreenRoute>} />
```

### Files changed
- **Created**: `src/components/financeiro/ContasPagarTabContent.tsx`, `src/pages/ContaPagarDetalhe.tsx`
- **Modified**: `src/pages/ContasAPagar.tsx` (replace tab content), `src/App.tsx` (add route)
- **Migration**: Create `fn_criar_titulo_com_parcelas` function

