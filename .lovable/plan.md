

# Restaurar sincronização N8N → Contas a Pagar (função isolada)

## Diagnóstico

O endpoint legado **`POST /processar-transacao-n8n`** que o N8N usa para alimentar o Contas a Pagar foi envolvido pelo `secureHandler` (PR-24) e ainda passa pelo Lovable AI Gateway para classificar cada transação por IA antes de gravar. Com os volumes atuais do N8N (lotes do PowerBI), a função estoura tempo/CPU e devolve 500/timeout. Ele nunca foi desenhado para o pipeline em massa do N8N de Contas a Pagar — era um classificador IA reaproveitado.

A API nova (`contas-pagar-api/sync`) já cobre o fluxo correto (upsert por `erp_id`, hash, batch, retry), mas o usuário pediu para **não tocar nela** e **criar uma função N8N dedicada**, recebendo o formato `$items()` do N8N (`[{json: {...}}, ...]`) que estava em produção.

## O que vou criar

### 1. Nova edge function isolada: `contas-pagar-n8n-sync`

Caminho: `supabase/functions/contas-pagar-n8n-sync/index.ts`. **Não passa por `secureHandler`** (CORS + auth manual leves, igual ao `/sync` legado), para preservar o contrato antigo do N8N e evitar WAF derrubando lotes grandes.

**Contrato (idêntico ao formato em produção):**

- `POST` (sem path adicional, ou aceita `/sync` opcional).
- Header obrigatório: `x-api-key: <N8N_API_KEY>` (mesma chave já configurada).
- Body aceita os 3 formatos legados, na ordem:
  1. `$items()` puro do N8N: `[ {json: {...}}, ... ]` → desempacota `.json`.
  2. Wrapper: `{ "contas": [ {...} ] }` ou `{ "data": [...] }`.
  3. Array bruto: `[ {...}, {...} ]`.
- Aceita os campos brutos do ERP (`ID Empresa`, `Tipo`, `Nota`, `Seq`, `Código`, `Valor_Trc`, `Valor em Aberto`, `Valor Pago`, `Emissão`, `Vencimento`, `Data Pgto`, `Cliente`, etc.) **sem Zod estrito** — passa direto pelo `transformErpData` + `generateErpId` que já existem em `_shared/contas-pagar/utils.ts`.

**Comportamento:**

- Reusa `processRecordsWithRetry` de `_shared/contas-pagar/utils.ts` (mesmo upsert por `erp_id`, hash incremental, retry exponencial). Garante paridade total com o que a API nova faz, sem duplicar lógica.
- Sem rate limiter de slots (era um gargalo do `bulk-sync`); aceita lote único de até `MAX_PAYLOAD_SIZE` (200k) e processa em mini-batches de 100.
- Sem chamadas de IA, sem lookup de plano de contas, sem `secureHandler`. Apenas: auth → desempacota → transforma → upsert → loga em `sync_control`.
- Resposta no mesmo shape que o N8N já espera:

```json
{
  "success": true,
  "received": 2000,
  "processed": 2000,
  "inserted": 120,
  "updated": 80,
  "skipped": 1800,
  "errors": 0,
  "duration_ms": 4500,
  "rate_per_second": 444,
  "api_version": "n8n-cp-1.0.0"
}
```

- Ao final, dispara `recalculate_contas_pagar_status` (RPC já existente) para manter status coerentes, igual o `/sync` legado.

### 2. Documentação

Atualizar `docs/N8N_WEBHOOK_CONTAS_RECEBER.md` (criar par equivalente para CP) com a nova URL:
`https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-n8n-sync`

Bloco com cabeçalhos, exemplo de payload nos 3 formatos, e instrução para o N8N apenas trocar a URL — nada mais muda.

### 3. Não-escopo (intocado, conforme regra)

- `contas-pagar-api/index.ts` e tudo em `_shared/contas-pagar/` (handlers, types, secureHandler) — **zero alteração**.
- `processar-transacao-n8n` — fica como está (continua útil para o pipeline IA de outras planilhas).
- Versões SDK/OpenAPI/APP — sem bump (função nova, fora do contrato público da CP API).

## Por que isso resolve

| Sintoma legado | Causa | Correção |
|---|---|---|
| 500/timeout no N8N | `processar-transacao-n8n` faz IA por item + secureHandler em lote massivo | Função nova sem IA, sem WAF, com mini-batch + retry |
| WAF/IP bloqueando picos | `secureHandler` aplica WAF L7 a toda CP API | Função nova roda com CORS + x-api-key apenas |
| Formato `$items()` rejeitado | Endpoint legado esperava `{transacoes: [...]}` | Aceita os 3 formatos do N8N nativamente |
| Paridade de dados | Risco de divergir da API nova | Reusa `transformErpData`, `generateErpId`, `processRecordsWithRetry` do mesmo `_shared/` |

## Validação após deploy

1. `curl -X POST .../contas-pagar-n8n-sync -H "x-api-key: $N8N_API_KEY" -d '[{"json":{"ID Empresa":2,"Tipo":"8","Nota":"71006","Seq":2,"Código":"3","Valor_Trc":0.01,"Vencimento":"2089-12-31"}}]'` → esperado 200 com `processed:1`.
2. Conferir em `sync_control` linha nova com `entidade='contas_pagar'`, status `success`.
3. Confirmar em `contas_pagar` o `erp_id` `2-8-71006-2-3` permanece consistente (mesmo upsert da API nova).
4. Apontar o workflow N8N para a nova URL e rodar 1 batch real de 2.000 itens.

## Impacto

**+1 função** (`contas-pagar-n8n-sync/index.ts`, ~150 linhas), **+1 doc** (`docs/N8N_WEBHOOK_CONTAS_PAGAR.md`). Zero migrações. Zero alteração nas APIs novas. Risco: baixo — função isolada, idempotente por `erp_id`, fallback silencioso para todos os formatos.

