

# Refatoração Modular — Contas a Pagar API

## Diagnóstico Atual

O `contas-pagar-api/index.ts` tem **2654 linhas** com **30 endpoints** em um único `if/else if` chain. O `contas-pagar-export-api/index.ts` (823 linhas) tem POST endpoints sem validação Zod e uma variável global `_currentReq` com race condition.

### Mapa de Endpoints (30 rotas)

```text
SYNC (6 rotas, ~600 linhas)
  POST /bulk-sync, /sync-incremental, /sync-chunk, /sync-complete, /sync
  GET  /chunks-progress

CRUD (7 rotas, ~800 linhas)
  POST /incluir, /upsert, /upsert-lote
  PUT  /update, /alterar
  DELETE /excluir
  GET  /consultar, /listar, /query

PAGAMENTOS (5 rotas, ~500 linhas)
  POST /registrar-pagamento, /lancar-pagamento, /cancelar-pagamento, /estornar
  GET  /pagamentos

PARCELAS (2 rotas, ~100 linhas)
  GET  /parcelas
  POST /parcelas/sync

ANEXOS (2 rotas, ~100 linhas)
  POST /anexos
  GET  /anexos

INFRA (3 rotas, ~200 linhas)
  GET  /status, /stats, /last-sync
  POST /trigger-n8n, /debug-payload
```

## Estratégia

Mover a lógica de cada grupo para módulos em `supabase/functions/_shared/contas-pagar/`, mantendo `index.ts` como router fino (~150 linhas). Isso é permitido pois `_shared/` já é usado extensivamente.

### Fase 1 — Módulos Shared + Router (principal)

**Novos arquivos:**

| Arquivo | Conteúdo | ~Linhas |
|---|---|---|
| `_shared/contas-pagar/types.ts` | Schemas Zod + interfaces comuns | ~120 |
| `_shared/contas-pagar/utils.ts` | `withRetry`, `logAuditEvent`, `parseDate`, `logSuccess/logError`, constantes | ~200 |
| `_shared/contas-pagar/sync-handlers.ts` | `handleBulkSync`, `handleSyncIncremental`, `handleSyncChunk`, `handleSyncComplete`, `handleChunksProgress`, `handleSync` | ~600 |
| `_shared/contas-pagar/crud-handlers.ts` | `handleIncluir`, `handleAlterar`, `handleExcluir`, `handleUpsert`, `handleUpsertLote`, `handleConsultar`, `handleListar`, `handleQuery`, `handleUpdate` | ~800 |
| `_shared/contas-pagar/payment-handlers.ts` | `processPayment` (unificado), `handleRegistrarPagamento`, `handleLancarPagamento`, `handleCancelarPagamento`, `handleEstornar`, `handleGetPagamentos` | ~400 |
| `_shared/contas-pagar/parcela-handlers.ts` | `handleGetParcelas`, `handleSyncParcelas` | ~100 |
| `_shared/contas-pagar/anexo-handlers.ts` | `handlePostAnexos`, `handleGetAnexos` | ~100 |
| `_shared/contas-pagar/infra-handlers.ts` | `handleStatus`, `handleStats`, `handleLastSync`, `handleTriggerN8n`, `handleDebugPayload` | ~200 |

**Arquivo refatorado — `contas-pagar-api/index.ts` (~150 linhas):**

```typescript
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { validateAnyAuth, validateErpAuth } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
// Import all handler groups
import { handleBulkSync, handleSync, ... } from "../_shared/contas-pagar/sync-handlers.ts";
import { handleIncluir, handleAlterar, ... } from "../_shared/contas-pagar/crud-handlers.ts";
import { handleRegistrarPagamento, handleLancarPagamento, ... } from "../_shared/contas-pagar/payment-handlers.ts";
// ...

Deno.serve(async (req) => {
  if (handleCors(req)) return handleCors(req)!;
  const path = new URL(req.url).pathname;
  const supabase = createClient(...);
  const ctx = { supabase, req, startTime: Date.now() };

  // Auth + rate limit (mantém lógica atual)
  // ...

  // Router — dispatch por path
  const routes: Record<string, () => Promise<Response>> = {
    'bulk-sync:POST':    () => handleBulkSync(ctx),
    'sync:POST':         () => handleSync(ctx),
    'incluir:POST':      () => handleIncluir(ctx),
    'registrar-pagamento:POST': () => handleRegistrarPagamento(ctx),
    // ... todas as 30 rotas
  };

  const key = `${path.split('/').pop()}:${req.method}`;
  const handler = routes[key];
  if (handler) return handler();
  return notFound(req);
});
```

### Fase 2 — Unificação de Pagamento

`/registrar-pagamento` e `/lancar-pagamento` compartilham 80% da lógica. Diferenças:

| Aspecto | registrar-pagamento | lancar-pagamento |
|---|---|---|
| Lookup | por `conta_pagar_id` (UUID) | por `codigo_lancamento_integracao` ou `codigo_lancamento` |
| Validação | manual (`if !campo`) | Zod `LancarPagamentoSchema` |
| Desconto/Juros/Multa | não suporta | suporta |
| Overpayment check | não tem | 105% do valor original |
| Response format | `{ success, pagamento }` | `{ codigo_status, descricao_status }` (Huggs-style) |

**Solução — `processPayment()` unificado:**

```typescript
interface PaymentInput {
  tituloId: string;
  valor: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  dataPagamento?: string;
  observacao?: string;
  codigoBaixaIntegracao?: string;
  conciliarDocumento?: boolean;
  origem: 'internal' | 'huggs';
}

async function processPayment(ctx: HandlerContext, input: PaymentInput) {
  // 1. Buscar título
  // 2. Validar status (não cancelado, não pago)
  // 3. Calcular valor líquido
  // 4. Overpayment check (105%)
  // 5. Inserir pagamento
  // 6. Atualizar título
  // 7. Audit log
  // 8. Webhook dispatch
  return { pagamento, titulo, liquidado };
}
```

Cada endpoint chama `processPayment()` e formata a resposta no seu estilo.

### Fase 3 — Validação Zod na Export API

Adicionar schemas para os 4 POST endpoints sem validação:

```typescript
const ConfirmSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(["exported", "failed"]).optional(),
}).strict();

const ExportBatchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  channel: z.string().max(50).optional(),
}).strict();

const RetryFailedSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100).optional(),
  max_retries: z.number().int().min(1).max(10).optional(),
}).strict();

const WebhookPushSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16).optional(),
}).strict();
```

Também remover `let _currentReq: Request` (race condition) — passar `req` como argumento para as funções handler.

## Impacto

- **Zero breaking changes**: Todos os endpoints mantêm exatamente os mesmos paths, métodos, request/response formats
- **Testabilidade**: Cada módulo pode ser testado isoladamente
- **Manutenibilidade**: De 2654 linhas em 1 arquivo para ~8 arquivos de 100-800 linhas
- **Segurança**: Export API passa a rejeitar payloads malformados com 400 em vez de comportamento indefinido

## Ordem de Execução

1. Criar `_shared/contas-pagar/types.ts` e `utils.ts` (base)
2. Extrair handlers por grupo (sync → crud → payments → parcelas → anexos → infra)
3. Refatorar `index.ts` para router fino
4. Unificar `processPayment()`
5. Adicionar Zod schemas na export API + remover `_currentReq`

**Estimativa**: ~8 arquivos novos, 1 arquivo refatorado, 1 arquivo atualizado

