

# Auditoria Atualizada das APIs — Nota Atual: 82/100

## O que foi corrigido desde a auditoria anterior (72→82)

- CORS lockdown em `api-sandbox`, `api-health-check`, `produtos-api`, `integration-router` — migrados para `_shared/cors.ts`
- Auth padronizado em `produtos-api`, `integration-router` — migrados para `validateAnyAuth()`
- `erp-webhook-inbound` migrado para `Deno.serve()` e `npm:` import
- `categorias-api` e `lancamentos-cc-api` — `json()` local agora delega para `jsonResponse()`
- `webhook-dispatcher` — migrado para `_shared/response.ts`

## Problemas Restantes (18 pontos)

### PROBLEMA 1: 94 funções ainda com `Access-Control-Allow-Origin: *` (–6pts)

A correção anterior cobriu apenas as 4 funções do plano original. Restam **~90 funções** com CORS `*` hardcoded — incluindo funções sensíveis como `cobranca-automation-api`, `vendas-union-api`, `erp-export-payment`, `fiscal-iva-api`, `price-table-approval`, entre outras.

**Funções de alto risco com CORS `*`:**
- `erp-export-payment` (exportação financeira)
- `vendas-union-api` (dados de vendas)
- `cobranca-automation-api` (automação de cobrança)
- `price-table-approval` (aprovação de preços)
- `fiscal-iva-api` (dados fiscais)
- `realtime-call-session` (sessões de chamada)

### PROBLEMA 2: 85 funções ainda usando `serve()` deprecado (–3pts)

A migração para `Deno.serve()` cobriu apenas `erp-webhook-inbound`. Restam ~85 funções usando `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"`.

### PROBLEMA 3: 16 funções com imports `esm.sh` em vez de `npm:` (–2pts)

Funções com imports divergentes de Supabase:
- `vendas-union-api` (`esm.sh@2.38.4`)
- `price-table-approval` (`esm.sh@2.58.0`)
- `export-conversion-rates`, `export-all-data`, `export-prospects`, `trade-marketing-api` (`esm.sh@2.39.3`)
- `realtime-call-session`, `process-call-result` (`esm.sh@2.38.4`)
- `save-brand-analysis` (`esm.sh@2.7.1`)
- `_shared/erp-key-validator.ts` (`esm.sh@2`)
- E mais 6 funções com `esm.sh@2` genérico

### PROBLEMA 4: 9 funções com `json()` local duplicado (–2pts)

Funções que definem `json()` localmente em vez de usar `_shared/response.ts`:
- `contas-correntes-api`, `erp-plano-contas-api`, `erp-fornecedores-sync`, `erp-fornecedores-query`, `erp-portadores-api`, `webhook-subscriptions-api`, `orcamentos-caixa-api`, `asana-sync`, `erp-webhook-inbound`

### PROBLEMA 5: Zod ausente nos endpoints de escrita críticos (–3pts)

`boletos-api`, `clientes-api`, `categorias-api` — nenhum deles implementou validação Zod nos POST endpoints (o plano anterior listou mas não implementou).

### PROBLEMA 6: Import Zod inconsistente (–1pt)

3 padrões coexistentes:
- `https://esm.sh/zod@3.22.4` (_shared/validate.ts)
- `https://deno.land/x/zod@v3.22.4/mod.ts` (analisar-planilha-ia, cnpjbiz-consulta, analyze-gondola-competition)
- Nenhum Zod (maioria das APIs)

### PROBLEMA 7: `contas-receber-api` usa `timingSafeEqual` direto (–1pt)

Importa `timingSafeEqual` diretamente em vez de usar `validateAnyAuth()` ou `validateErpAuth()`.

---

## Plano de Correção (18 pontos para 100%)

### Fase 1: CORS lockdown em massa (–6pts → 0)

Migrar as ~90 funções restantes para usar `_shared/cors.ts`. Priorizar as 6 de alto risco primeiro, depois batch das demais.

**Padrão de migração:**
```
- Remover: const corsHeaders = { "Access-Control-Allow-Origin": "*", ... }
+ Adicionar: import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
+ Substituir: corsHeaders → getCorsHeaders(req)
```

### Fase 2: Zod nos 3 endpoints críticos (–3pts → 0)

Adicionar schemas Zod em:
- `boletos-api` — POST gerar/cancelar/prorrogar
- `clientes-api` — POST incluir/alterar
- `categorias-api` — POST incluir/alterar

### Fase 3: `serve()` → `Deno.serve()` em massa (–3pts → 0)

Migrar as ~85 funções restantes do padrão:
```
- import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
- serve(async (req) => { ... });
+ Deno.serve(async (req) => { ... });
```

### Fase 4: Imports `esm.sh` → `npm:` (–2pts → 0)

Padronizar 16 funções + `_shared/erp-key-validator.ts` para `npm:@supabase/supabase-js@2`.

### Fase 5: Eliminar `json()` duplicado restante (–2pts → 0)

Migrar 9 funções para usar `jsonResponse` de `_shared/response.ts`.

### Fase 6: Cleanup menor (–2pts → 0)

- Padronizar import Zod para `https://esm.sh/zod@3.22.4`
- `contas-receber-api` — usar `validateAnyAuth()` em vez de `timingSafeEqual` direto

---

## Arquivos a alterar

| Prioridade | Arquivos | Alteração |
|---|---|---|
| Alta | ~6 funções financeiras/fiscais | CORS lockdown |
| Alta | boletos-api, clientes-api, categorias-api | Zod schemas |
| Média | ~84 funções restantes | CORS lockdown |
| Média | ~85 funções | `serve()` → `Deno.serve()` |
| Média | 16 funções + erp-key-validator | `esm.sh` → `npm:` |
| Baixa | 9 funções | `json()` → `jsonResponse()` |
| Baixa | contas-receber-api | Usar `validateAnyAuth()` |

**Total de arquivos afetados: ~100+ edge functions**

Dado o volume, a implementação será em batches de ~15-20 funções por iteração.

## Resultado esperado

- 0 funções com CORS `*`
- 0 funções com `serve()` deprecado
- 0 imports `esm.sh`
- 0 helpers `json()` duplicados
- Zod em todos os endpoints de escrita críticos
- **Nota: 100/100**

