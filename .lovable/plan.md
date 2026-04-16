

# Diagnóstico Completo — Frontend Contas a Pagar vs APIs

## Nota atual: 7.5/10

O frontend cobre a maioria das operações CRUD e ERP, mas tem problemas estruturais de duplicação, gaps de integração com features recentes das APIs, e inconsistências que comprometem a experiência profissional.

---

## PROBLEMA CRÍTICO: Duas telas fazendo a mesma coisa

Existem **duas telas de Contas a Pagar** com propósitos sobrepostos:

| Tela | Rota | Acesso a dados | Problema |
|---|---|---|---|
| `ContasPagarGestao` | `/dashboard/contas-pagar` | **Supabase direto** (INSERT/UPDATE/SELECT) | Bypass total das APIs, sem idempotência, sem transação atômica, sem audit trail via API |
| `PainelCentralAP` | `/dashboard/financeiro/ap-central` | **Via APIs** (`callApi`, `callExportApi`) | Correto, usa todas as APIs profissionalizadas |

**`ContasPagarGestao` é um risco financeiro ativo.** Ela faz pagamentos com INSERT direto no Supabase (`supabase.from("pagamentos").insert(...)` + `supabase.from("contas_pagar").update(...)`) — duas queries separadas, sem transação atômica. Se uma falhar e a outra não, gera inconsistência. O RPC `process_payment_atomic` existe mas não é usado ali.

### Recomendação: Deprecar `ContasPagarGestao`

Migrar toda a funcionalidade para `PainelCentralAP` (que já usa as APIs) e remover `ContasPagarGestao`, ou refatorá-la para usar as APIs em vez de acesso direto ao banco.

---

## GAPS — Frontend não usa features das APIs v2.4.0

### 1. Idempotência não aplicada no frontend

As APIs suportam `X-Idempotency-Key` mas o `callApi()` e `callExportApi()` em `api-helpers.ts` **nunca enviam esse header**. O SDK externo envia automaticamente, mas o próprio sistema interno não. Risco: retry de pagamento duplica o registro.

**Correção**: Adicionar `X-Idempotency-Key: crypto.randomUUID()` em `callApi` e `callExportApi` para POST/PUT.

### 2. Cursor pagination não utilizada

APIs suportam `cursor` param para paginação performática, mas `PainelCentralAP` usa apenas `pagina` + `registros_por_pagina` (offset). Para tabelas grandes (>10k registros) isso degrada performance.

### 3. Endpoint `/query` não utilizado por nenhuma tela

O endpoint GET `/query` (com `limit/offset/cursor`, filtros avançados por `fornecedor_codigo`, `emissao_de/ate`, `status`) existe na API mas nenhuma tela o consome. `PainelCentralAP` usa `/listar` (estilo Huggs) exclusivamente.

### 4. `meta` envelope ignorado

As respostas da API v2.4.0 incluem `meta.request_id` e `meta.duration_ms` — úteis para debugging e auditoria no frontend. Nenhuma tela captura ou exibe essa informação.

---

## GAPS — Funcionalidades faltantes no frontend

### 5. Sem tela de detalhe individual do título

A rota `/dashboard/financeiro/contas-a-pagar/:id` existe no router mas o componente `ContaPagarDetalhe` não foi encontrado na análise. Provavelmente existe mas deve ser verificado se tem: parcelas, pagamentos, anexos, timeline de histórico, status ERP — tudo em uma visão consolidada.

### 6. Falta filtro por Empresa

`PainelCentralAP` tem filtros por Status, Categoria, Departamento, Fornecedor, Vencimento — mas **não tem filtro por Empresa**. Para operações multi-empresa isso é essencial.

### 7. Falta filtro por Emissão (data)

A API suporta `filtrar_por_emissao_de/ate` mas `PainelCentralAP` só filtra por vencimento.

### 8. Falta exportação para Excel/CSV

`PainelCentralAP` não tem botão de exportação. A tela principal de Contas a Pagar (`ContasAPagar`) tem, mas o painel central admin não.

### 9. Falta bulk actions na tabela

Não há seleção múltipla (checkboxes) em `PainelCentralAP` para: cancelar em lote, enviar ao ERP em lote, ou exportar selecionados.

### 10. `CadastroTituloAP` não enfileira ERP após inclusão

Ao criar um título novo, o `PostPaymentErpPrompt` é exibido, mas o prompt usa `callExportApi("/export-batch")` — que é para pagamentos, não provisões. A provisão deveria usar `enqueueErpSync({ operacao: "provisao" })`.

### 11. Conciliação Manual sem idempotência

`ConciliacaoManualAP` faz `callApi("contas-pagar-api", { path: "/registrar-pagamento" })` sem `X-Idempotency-Key`. Em operação de conciliação bancária, retry pode duplicar pagamentos.

---

## Plano de Correção

### Passo 1 — `api-helpers.ts`: Idempotência automática
Adicionar `X-Idempotency-Key` em `callApi` e `callExportApi` para métodos POST/PUT. Impacto: protege **todas** as telas automaticamente.

### Passo 2 — `PainelCentralAP.tsx`: Filtros faltantes
- Adicionar filtro por Empresa (dropdown com lista de empresas)
- Adicionar filtro por Data de Emissão (de/até)
- Adicionar botão "Exportar Excel" que chama `/export-summary` ou monta CSV local
- Adicionar bulk selection (checkboxes) com ações: Cancelar Lote, Enviar ERP Lote

### Passo 3 — `ContasPagarGestao.tsx`: Migrar para APIs
Substituir todos os acessos diretos ao Supabase por chamadas via `callApi("contas-pagar-api", ...)`:
- `supabase.from("contas_pagar").select(...)` → `callApi("contas-pagar-api", { path: "/listar" })`
- `supabase.from("pagamentos").insert(...)` + `supabase.from("contas_pagar").update(...)` → `callApi("contas-pagar-api", { path: "/registrar-pagamento" })` (usa RPC atômico)
- `supabase.from("contas_pagar").insert(...)` → `callApi("contas-pagar-api", { path: "/incluir" })`
- `supabase.from("contas_pagar").update({ status: "cancelado" })` → `callApi("contas-pagar-api", { path: "/cancelar" })`

### Passo 4 — `CadastroTituloAP.tsx`: Corrigir ERP prompt
Após inclusão de título, usar `enqueueErpSync({ operacao: "provisao" })` em vez de `callExportApi("/export-batch")`.

### Passo 5 — `callExportApi`: Capturar `meta`
Logar `meta.request_id` em console.debug para facilitar debugging. Opcionalmente exibir `duration_ms` em modo dev.

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/lib/utils/api-helpers.ts` | Idempotência automática em POST/PUT, captura de `meta` |
| `src/pages/financeiro/PainelCentralAP.tsx` | Filtro empresa, filtro emissão, export Excel, bulk actions |
| `src/pages/ContasPagarGestao.tsx` | Migrar de Supabase direto para APIs (eliminar bypass) |
| `src/pages/financeiro/CadastroTituloAP.tsx` | Corrigir ERP prompt pós-inclusão |
| `src/pages/financeiro/ConciliacaoManualAP.tsx` | Idempotência via `callApi` (automático após Passo 1) |

## Impacto

- Elimina risco de inconsistência financeira (pagamentos não-atômicos)
- Idempotência protege contra duplicatas em todo o frontend
- Filtros completos para operação multi-empresa
- Bulk actions reduzem trabalho operacional
- Uma única camada de acesso a dados (APIs) em vez de acesso direto ao banco

