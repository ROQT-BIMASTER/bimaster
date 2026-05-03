# Input Validation — Phase 5 Lote A

## Padrão

Toda Edge Function que aceita JSON deve:

1. Definir um schema Zod com `.strict()` (recusa campos extras → defesa contra mass-assignment).
2. Usar `safeParse` + retorno 400 com código `VAL-001` e path do campo que falhou.
3. Para multi-op (`{ op: "criar" | "atualizar" }`), usar `z.discriminatedUnion("op", [...])`.

```ts
import { z } from "https://esm.sh/zod@3.22.4";

const BodySchema = z.object({
  empresa_id: z.number().int().positive(),
  valor: z.number().positive().max(1_000_000_000),
}).strict();

const raw = await req.json().catch(() => ({}));
const parsed = BodySchema.safeParse(raw);
if (!parsed.success) {
  return new Response(
    JSON.stringify({ error: { code: "VAL-001", details: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`) } }),
    { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
}
const body = parsed.data;
```

## Convenção de códigos

| Código | Significado |
|---|---|
| `VAL-001` | Falha de validação Zod (tipo, formato, campo extra) |
| `VAL-002` | Regra de negócio violada (ex.: data passada, valor > limite por empresa) |

## Cobertura por lote

### Lote A.1 — Funções com schema simples (✅ aplicado nesta rodada)

- `classificar-categoria-dre`
- `auditoria-contas-pagar`
- `auditoria-contas-receber`
- `classificar-conta-departamento` (union strict por formato lançamento/conta)
- `classificar-contas-pagar-ia`
- `classificar-contas-batch`

### Lote A.0 — Já cobertos em rodadas anteriores

- `boletos-api` (3 schemas)
- `contas-receber-api` (8 schemas, 3 com `.strict()`)
- `erp-export-payment`
- `erp-webhook-inbound`
- `cnpjbiz-consulta` (2 schemas)
- `analyze-comments-sentiment`, `ai-creative-studio`, `analyze-gondola-competition`, `analisar-planilha-ia`, `analyze-whatsapp-sentiment`, `huggs-agent-chat`, `generate-product-creative`, `export-pdf`, `importar-briefing-ia`, `stitch-proxy` (10 schemas)

### Lote A.2 — Backlog (routers complexos com 10+ ops)

Ficam para PR dedicado, requerem `discriminatedUnion` + schema por op:

- `contas-pagar-api` (router com ~15 rotas: incluir, upsert, lancar-pagamento, cancelar, estornar, etc.)
- `contas-pagar-ai-chat`, `contas-pagar-n8n-sync`
- `lancamentos-cc-api`
- `movimentos-financeiros-api`
- `processar-transacao-n8n`, `conciliacao-bancaria`
- `erp-fornecedores-sync`, `erp-fornecedores-query`, `erp-sync-engine`, `erp-portadores-api`, `erp-plano-contas-api`
- `classificar-contas-lote` (797 LOC — multi-action)
- `cobranca-automation-api`, `cobranca-whatsapp-webhook`

Justificativa: cada um requer mapeamento individual das ops. Aplicar `.strict()` cego quebra integrações ativas (n8n, ERP). PR dedicado por função, com smoke test por op.

### Lote B — Admin/segurança (próxima rodada, após soak Lote A.1)

Ver master prompt original.

### Lote C — Operacional (~80 funções, backlog longo prazo)

Sem urgência.

## Verificação

```bash
for f in supabase/functions/{classificar-categoria-dre,auditoria-contas-pagar,auditoria-contas-receber,classificar-conta-departamento,classificar-contas-pagar-ia,classificar-contas-batch}/index.ts; do
  rg -q "\.strict\(\)" "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

Resultado esperado: 6× OK.

## Smoke test (manual, pós-deploy)

```bash
# campo extra → 400 VAL-001
curl -X POST $SUPABASE_URL/functions/v1/classificar-categoria-dre \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"accountCode":"1.1.01","accountName":"Caixa","accountType":"A","extra":"hack"}'
# → 400 VAL-001 (extra: Unrecognized key)

# payload válido → 200
curl -X POST $SUPABASE_URL/functions/v1/classificar-categoria-dre \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"accountCode":"1.1.01","accountName":"Caixa","accountType":"A"}'
# → 200 com classificação
```
