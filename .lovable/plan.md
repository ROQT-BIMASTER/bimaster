

## Diagnóstico — Onda 4 está fundamentalmente desalinhada com a spec

A Export API atual foi construída em cima de `financial_payment_queue` (1 registro, status `pending`, fluxo legado de outro módulo). Mas a spec da Onda 4 é explícita: "título nasce no Huggs, Export API enfileira para exportação ao ERP". O Huggs hoje vive em `contas_pagar` (48.244 registros: 865 pendentes, 43.614 pagos, 3 cancelados — dados criados pelas Ondas 1-3).

Resultado prático sem fix: todos os checklists da Onda 4 falham silenciosamente (arrays vazios) ou explodem com PG (coluna inexistente).

### Validação item-a-item

| Item | Endpoint | Estado real | Ação |
|---|---|---|---|
| **4A** | `GET /status` | OK estrutural, mas conta zero porque olha `financial_payment_queue` em vez de `contas_pagar`. | **FAZER** — base trocada |
| **4B** | `GET /pending` | Chama `handleGetItems(status='accepted')` em `financial_payment_queue`. Sempre `[]`. | **FAZER** — basear em `contas_pagar.status='pendente'` |
| **4C** | `GET /paid` | Mesmo problema. Sempre `[]`. | **FAZER** — basear em `contas_pagar.status='pago'` |
| **4D** | `GET /cancelled` | Lê `contas_pagar` corretamente, MAS faz `.in("conta_pagar_id", ids)` em `erp_export_queue` — **coluna não existe** → 500 PGRST204. | **FIX** — usar `payment_queue_id` (única coluna real) ou criar `conta_pagar_id` |
| **4E** | `POST /export-batch` | Insere com `payment_queue_id = uuid de contas_pagar`. Funciona como armazenamento, mas semanticamente o nome da coluna fica errado. Sem validação que o ID exista em `contas_pagar`. | **FIX** — validar referência |
| **4F** | `POST /confirm` | Mesmo: usa `payment_queue_id`. OK estrutural se o batch funcionou antes. | **N/A** após fix do 4E |
| **4G** | `GET /history` | Lista `erp_export_queue` direto. OK. | **N/A** smoke E2E |
| **4H** | `GET /export-summary` | Agrega `erp_export_queue`. OK. | **N/A** smoke E2E |
| **4I** | `GET /reconciliation` | Faz `.or('conta_pagar_id.in...')` — **coluna inexistente** → 500. | **FIX** — só `payment_queue_id` |
| **4J** | `POST /retry-failed` | OK lógico (filtra por `export_status='error'`). | **N/A** smoke E2E |

### Decisão de arquitetura: usar `payment_queue_id` para guardar UUID de `contas_pagar`

Duas opções:
- **(A) Migration**: adicionar `conta_pagar_id uuid` em `erp_export_queue`. Rastreabilidade explícita, mas exige reescrever todos os handlers para usar nova coluna + dual-write durante migração.
- **(B) Reusar `payment_queue_id` semanticamente como "ID externo do título"**. Zero migration. Coluna já é `uuid`. Os 0 registros existentes não têm conflito. Documentar a decisão.

**Escolha: (B).** Risco: muito baixo (tabela vazia, sem FK). Benefício: PR menor, sem schema drift novo. Vou documentar em memória + comentário no código.

## Plano de execução — PR-15 (v3.1.7)

### Fase A — Reescrever GETs para basearem em `contas_pagar`

**`handleGetItems` (pending/paid)**:
- Trocar fonte `financial_payment_queue` → `contas_pagar`.
- Mapear `financial_status='accepted'` → `status='pendente'`; `'paid'` → `status='pago'`.
- Filtros: `empresa_id`, `limit`, `offset` continuam.
- Cruzar com `erp_export_queue` por `payment_queue_id` para excluir já exportados (`export_type='registration'` para pending; `'payment'` para paid).
- Construir payload usando colunas reais de `contas_pagar`: `fornecedor_nome`, `fornecedor_codigo`, `valor_original`, `data_vencimento`, `numero_documento`, etc.

**`handleGetCancelledItems`**:
- Trocar `.in("conta_pagar_id", ids)` por `.in("payment_queue_id", ids)`.
- Resto fica igual (já lê `contas_pagar` correto).

**`handleStatusDetail`**:
- Trocar fonte para `contas_pagar`. Contar por `status='pendente'`/`'pago'`/`'cancelado'`.
- Subtrair os já exportados em `erp_export_queue` por tipo.

### Fase B — Fix `/reconciliation`

- Remover o ramo `conta_pagar_id.in.(...)` do `.or()`. Usar só `payment_queue_id`.
- Documentar no header da função: "payment_queue_id armazena UUID de contas_pagar (decisão PR-15)".

### Fase C — Validação de referência em `/export-batch`

- Antes de enfileirar, fazer um SELECT em batch nos `contas_pagar.id` IN (ids). 
- IDs não encontrados vão para `errors[]` com mensagem "título não encontrado em contas_pagar".
- Mantém compatibilidade: `queued`/`skipped` continuam.

### Fase D — Smoke E2E (em ordem) via `supabase--curl_edge_functions`

1. `GET /status` (com auth) → 200 com `provisao.pendentes ≥ 800` e `baixa.pendentes ≥ 40000` (refletindo dados reais).
2. `GET /pending?limit=3` → 200 com 3 títulos pendentes (mostrando `valor`, `fornecedor`, `empresa_id`).
3. `GET /paid?limit=3` → 200 com 3 pagos.
4. `GET /cancelled?limit=3` → 200, sem 500.
5. Pegar 2 IDs de `/pending` → `POST /export-batch` `{ids:[...], export_type:'registration'}` → `queued:2, skipped:0`.
6. `POST /export-batch` mesmos IDs novamente → `queued:0, skipped:2`.
7. `POST /export-batch` `{ids:['00000000-...']}` UUID inexistente → `errors:[{...título não encontrado...}]`, `queued:0`.
8. `GET /pending?limit=10` → títulos do passo 5 não aparecem mais.
9. `POST /confirm` `{ids:[...os 2...], export_type:'registration'}` → `confirmed:2`.
10. `GET /history?export_type=registration&limit=5` → 200 com os 2 itens em status `exported`.
11. `GET /export-summary` → 200 com `por_tipo.registration.exported ≥ 2`.
12. `GET /reconciliation?empresa_id=5` → 200 com `taxa_sincronizacao` numérico, sem 500.
13. `POST /retry-failed` `{}` → 200 com `retried:0` (ou >0 se houver erros legados).

### Fase E — Versionamento + regressão + memória

- Bump `APP_VERSION` `3.1.6 → 3.1.7` em `src/lib/version.ts`.
- 5 invariantes novos em `audit/regression-greps.sh`:
  - `contas_pagar` ≥3 em `contas-pagar-export-api/index.ts` (nova fonte).
  - `financial_payment_queue` ≤0 em handlers ativos (regressão proibida — exceto comentários).
  - `conta_pagar_id` ≤0 em filtros do export-api (coluna não existe em `erp_export_queue`).
  - `payment_queue_id` ≥6 (uso correto consolidado).
  - `APP_VERSION 3.1.7+` no `version.ts`.
- Atualizar `docs/fixes-abr26/IMPLEMENTATION_REPORT.md` com seção PR-15 / Onda 4.
- Atualizar `mem://finance/contas-pagar-governance-and-audit-standard`: "Export API usa `contas_pagar` como fonte; `erp_export_queue.payment_queue_id` armazena UUID de `contas_pagar`".

## Não-escopo

- Adicionar coluna `conta_pagar_id` a `erp_export_queue` (decisão B acima).
- Migrar dados de `financial_payment_queue` (1 registro vazio, sem valor).
- Refazer `/webhook-push` (não está no checklist da Onda 4).
- Tocar telas frontend (regra explícita).
- SDK/OpenAPI bump (sem mudança de contrato externo — `/pending` continua devolvendo `{data, total, offset, limit}` no mesmo shape).

## Impacto

2 arquivos editados (`contas-pagar-export-api/index.ts`, `src/lib/version.ts`, `audit/regression-greps.sh`) + 1 update de memória + 1 update de IMPLEMENTATION_REPORT. ~120 linhas mudadas (essencialmente reescrita de 3 handlers). 5 invariantes novos. Bump de patch (`3.1.7`). Risco de regressão: baixo — `erp_export_queue` está vazia (0 registros), então não há dados antigos pra quebrar; SDK externo não muda; o único shape que muda é o conteúdo de `/pending` e `/paid` que hoje retornam vazio mesmo.

