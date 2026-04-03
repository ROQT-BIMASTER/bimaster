

# Auditoria do Painel de APIs e APIs de Envio de Dados ao ERP — Nota: 82/100

## Pontuacao por Categoria

| Categoria | Nota | Peso | Pontos |
|---|---|---|---|
| Completude de Endpoints | 75 | 25% | 18.75 |
| Documentacao no Painel | 85 | 20% | 17.0 |
| Fluxo de Envio ao ERP | 78 | 25% | 19.5 |
| UX do Painel | 88 | 15% | 13.2 |
| Seguranca e Resiliencia | 85 | 15% | 12.75 |
| **TOTAL** | | | **81.2 ≈ 82/100** |

---

## PROBLEMAS IDENTIFICADOS

### 1. clientes-api sem `/upsert-lote` (–5pts)

Todas as APIs financeiras (contas-pagar, contas-correntes, lancamentos-cc) possuem endpoint de **upsert em lote** (batch de 500 registros). A `clientes-api` possui apenas upsert unitario (`/upsert` e `/upsert-cpfcnpj`), forçando o ERP a fazer N chamadas individuais para sincronizar clientes em massa.

### 2. clientes-api sem `/sync` bidirecional (–4pts)

A API de fornecedores tem `/sync-bidirecional` e `/cadastrar-todas`, mas a `clientes-api` nao tem nenhum endpoint de sync com o ERP. O ERP nao consegue disparar uma sincronizacao completa de clientes — precisa usar upsert unitario repetidamente.

### 3. Documentacao do Painel: endpoints de Clientes sem body/response completos (–3pts)

Na `ApiDocumentation.tsx`, os endpoints `/upsert` e `/upsert-cpfcnpj` nao mostram a response esperada. Endpoints como `/associar` nao tem response documentada.

### 4. erp-export-payment usa `jsonResponse` local em vez de `_shared/response.ts` (–2pts)

A funcao `erp-export-payment` define sua propria `jsonResponse()` local (linha 342), nao importa da `_shared/response.ts`. Inconsistente com o padrao estabelecido.

### 5. erp-export-payment sem Zod validation (–2pts)

O body do request nao e validado com Zod — aceita qualquer JSON. Campos como `payment_queue_id` e `action` devem ser validados.

### 6. contas-pagar-export-api usa `timingSafeEqual` direto (–1pt)

Importa `timingSafeEqual` de `_shared/timing-safe.ts` em vez de usar `validateAnyAuth()`. Padrao inconsistente ja identificado anteriormente.

### 7. Painel nao documenta erp-export-payment (–2pts)

A funcao `erp-export-payment` (que envia dados ao ERP via N8N/REST/SQL Direct) nao aparece na documentacao do painel. E a API principal de envio de dados ao ERP e esta invisivel para o cliente.

### 8. Falta endpoint de Contas a Receber para exportacao ao ERP (–3pts)

Existe `contas-pagar-export-api` com pull/batch/reconciliacao, mas nao existe equivalente para **Contas a Receber**. Se o cliente precisa enviar recebimentos ao ERP, nao tem API.

---

## PLANO DE CORRECAO (18 pontos para 100%)

### Fase 1: Endpoints de Batch para Clientes (+9pts)

**1a. Adicionar `/upsert-lote` na clientes-api:**
- Aceitar array de ate 500 clientes
- Validar com Zod (array de IncluirClienteSchema)
- Upsert por `codigo` (onConflict)
- Retornar contagem de processados/erros

**1b. Adicionar `/sync` na clientes-api:**
- Endpoint para sync bidirecional simplificado
- Aceitar filtros (empresa_id, atualizado_desde)
- Retornar clientes alterados desde ultima sync

### Fase 2: Documentacao e Padronizacao (+5pts)

**2a. Adicionar bloco de Exportacao ERP (erp-export-payment) no painel:**
- Documentar os 3 actions: export, retry, status
- Documentar os 3 channels: n8n, rest_api, sql_direct
- Documentar os 2 export_types: registration (provisao), payment (baixa)

**2b. Completar responses faltantes nos endpoints de Clientes:**
- `/upsert`, `/upsert-cpfcnpj`, `/associar` — adicionar response na documentacao

### Fase 3: Seguranca e Consistencia (+4pts)

**3a. erp-export-payment:**
- Importar `jsonResponse` de `_shared/response.ts`
- Adicionar Zod schema para o body (action, payment_queue_id, channel, export_type)

**3b. contas-pagar-export-api:**
- Migrar de `timingSafeEqual` direto para `validateAnyAuth()`

---

## Arquivos a alterar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/clientes-api/index.ts` | Adicionar `/upsert-lote` e `/sync` |
| `supabase/functions/erp-export-payment/index.ts` | Zod validation, usar `_shared/response.ts` |
| `supabase/functions/contas-pagar-export-api/index.ts` | Migrar para `validateAnyAuth()` |
| `src/components/erp/ApiDocumentation.tsx` | Adicionar modulo "Exportacao ERP" com erp-export-payment, completar responses de Clientes |

### Resultado esperado

- clientes-api com upsert em lote (500/request) e sync
- erp-export-payment documentado e visivel no painel
- Todas as APIs de envio ao ERP com Zod validation
- Documentacao completa com body/response em todos os endpoints
- **Nota estimada: 96-100/100**

