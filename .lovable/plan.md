

# Analise Profunda — Melhorias nas APIs de Contas a Pagar

## Inventario do Ecossistema AP

O sistema de Contas a Pagar envolve **7 Edge Functions** e componentes de suporte:

| Funcao | Endpoints | Linhas | Papel |
|---|---|---|---|
| `contas-pagar-api` | ~25 | 2528 | CRUD principal, sync N8N, Huggs-style |
| `contas-pagar-export-api` | 11 | 823 | Pull API para ERP externo |
| `erp-export-payment` | 3 | 339 | Push de pagamentos para ERP |
| `erp-webhook-inbound` | 1 | 195 | Recepcao de webhooks do ERP |
| `auditoria-contas-pagar` | 1 | 564 | Auditoria com IA |
| `auto-classificar-contas` | 1 | 133 | Classificacao automatica por IA |
| `contas-pagar-ai-chat` | (assistente) | — | Chat IA financeiro |

---

## PROBLEMAS IDENTIFICADOS (por severidade)

### CRITICO — Bugs que causam erro em producao

**1. Campo `empresa_id` no banco e `integer`, mas Zod aceita `z.union([z.string(), z.number()])`.** O IncluirSchema aceita string para `empresa_id`, que ao ser inserido na coluna `integer` do Postgres funciona por coercao, mas o campo `codigo_cliente_fornecedor` e `bigint` no banco e o Zod aceita `z.string().optional()` — se o integrador enviar uma string nao-numerica (ex: UUID), o INSERT falhara com erro 500 sem mensagem clara. Falta coercao explicita `z.coerce.number()` ou validacao de formato numerico.

**2. `/alterar` nao valida status antes de modificar.** A governanca de AP (mem://finance/contas-pagar-governance-and-audit-standard) diz que titulos com status `pago` ou `cancelado` nao podem ser alterados. O endpoint `/alterar` aceita qualquer alteracao em qualquer status — inclusive alterar valor de titulo ja pago.

**3. `/excluir` faz soft-delete (status='cancelado') mas nao verifica se o titulo ja esta pago.** Permite "excluir" um titulo pago, o que corrompe os saldos contabeis.

**4. `/upsert-lote` nao usa Zod para validar cada registro.** Aceita campos arbitrarios via spread (`...reg`), violando a protecao contra mass assignment que todos os outros endpoints implementam.

**5. `/lancar-pagamento` nao verifica se o titulo ja esta liquidado.** Se o integrador chamar `/lancar-pagamento` duas vezes no mesmo titulo, o `valor_pago` sera somado duas vezes sem limite. Nao ha verificacao se `valor_pago + novo_valor > valor_original` (pagamento a maior nao intencional).

**6. `erp-webhook-inbound` faz `baixa_confirmada` sem atualizar `status` para 'pago'.** Linha 170 atualiza `valor_pago`, `valor_aberto=0`, `data_pagamento`, mas NAO seta `status='pago'`. O titulo fica com saldo zero mas status antigo (ex: 'pendente').

### ALTO — Falhas de seguranca e consistencia

**7. `auditoria-contas-pagar` usa `auth: "none"` no secureHandler.** Qualquer pessoa pode disparar a auditoria completa (que carrega ate 5000 registros financeiros). Deveria exigir JWT admin.

**8. `auto-classificar-contas` usa service role key para chamar outra Edge Function interna.** Envia `Authorization: Bearer ${supabaseKey}` com a SERVICE_ROLE_KEY diretamente no header. Isso e um risco — se logado, expoe a chave no audit trail.

**9. `/registrar-pagamento` e `/lancar-pagamento` sao dois endpoints diferentes com logica similar mas inconsistente.** O primeiro insere na tabela `pagamentos` e atualiza `contas_pagar`. O segundo faz o mesmo mas com campos diferentes (Huggs-style). Nao ha deduplicacao — o integrador pode confundir os dois.

**10. `contas-pagar-export-api` usa `parseInt(empresaId)` na reconciliacao (linha 614).** Se `empresa_id` no banco for string/bigint diferente de integer, isso falha silenciosamente.

**11. Sem idempotencia em `/incluir`.** Se o integrador enviar o mesmo payload duas vezes, cria duas contas. O 409 so funciona se houver constraint unique em `codigo_lancamento_integracao`, mas a constraint real e `(empresa_id, codigo_lancamento_integracao)` e o campo `empresa_id` e opcional no IncluirSchema.

### MEDIO — Melhorias de robustez

**12. Health check expoe configuracao interna.** `/status` retorna `bulk_batch_size`, `max_payload_size`, `max_retries` — informacao util para atacantes calibrarem DDoS.

**13. Sem paginacao no GET raiz.** `GET /contas-pagar-api` retorna `LIMIT 100` sem count, sem offset, sem filtros — inutil para integradores.

**14. `/cancelar` nao verifica status antes de cancelar.** Permite cancelar titulo ja pago (deveria exigir estorno primeiro).

**15. `parseDate` aceita qualquer string.** `new Date("abc")` retorna `Invalid Date` que falha silenciosamente — `isNaN(date.getTime())` retorna null, mas nao rejeita o request. O integrador nao sabe que a data foi ignorada.

**16. Sem webhook dispatch apos mutacoes.** `/incluir`, `/alterar`, `/excluir`, `/lancar-pagamento` nao chamam `enqueueWebhookEvent` (importado mas nunca usado). Os assinantes de webhook nao recebem notificacoes.

**17. `/estornar` sobrescreve observacao.** Seta `observacao: 'Estorno: ${motivo}'`, perdendo a observacao original do titulo.

**18. Rate limiter usa tabela `sync_rate_limiter` com slots por request UUID, mas nao diferencia por empresa.** Uma empresa pode consumir todos os slots, bloqueando outras.

---

## PLANO DE MELHORIAS (priorizacao)

### Fase 1 — Correcoes Criticas (3 arquivos)

**Arquivo: `supabase/functions/contas-pagar-api/index.ts`**

1. **Governanca de status em `/alterar` e `/excluir`**: Adicionar verificacao de status antes de permitir alteracao. Rejeitar com 400 se status = 'pago' ou 'cancelado'.

2. **Validacao de pagamento duplicado em `/lancar-pagamento`**: Verificar se `valor_pago + novo_valor > valor_original * 1.05` (margem de 5% para juros). Se sim, retornar warning ou erro.

3. **Zod em `/upsert-lote`**: Validar cada registro do array com `UpsertSchema.safeParse` antes de processar.

4. **Coercao numerica em campos de ID**: Alterar `empresa_id`, `codigo_cliente_fornecedor`, `id_conta_corrente` para `z.coerce.number().optional()` nos schemas Zod, garantindo que strings numericas funcionem e strings nao-numericas sejam rejeitadas.

5. **Dispatch de webhooks**: Adicionar `enqueueWebhookEvent` em `/incluir` (conta_pagar.criado), `/alterar` (conta_pagar.alterado), `/excluir` (conta_pagar.excluido), `/lancar-pagamento` (conta_pagar.pago).

6. **Idempotencia em `/incluir`**: Quando `empresa_id` nao e informado, usar o empresa_id padrao (ou rejeitar).

7. **Status check em `/cancelar`**: Rejeitar se titulo ja esta pago.

8. **Fix `/estornar` observacao**: Concatenar em vez de sobrescrever (`observacao = old_obs + ' | Estorno: ' + motivo`).

9. **Sanitizar health check**: Remover `config` do response de `/status`, manter apenas `status`, `version`, `timestamp`, `rate_limiting.available_slots`.

**Arquivo: `supabase/functions/erp-webhook-inbound/index.ts`**

10. **Fix `baixa_confirmada` sem status**: Adicionar `status: 'pago'` ao update da linha 170.

**Arquivo: `supabase/functions/auditoria-contas-pagar/index.ts`**

11. **Trocar auth para JWT**: Alterar `auth: "none"` para `auth: "jwt"` no secureHandler. Adicionar verificacao de role admin.

### Fase 2 — Melhorias de Robustez

12. **Melhorar parseDate**: Rejeitar datas invalidas com erro 400 em vez de ignorar silenciosamente.
13. **Rate limiter por empresa**: Adicionar `empresa_id` ao slot key para evitar starvation.
14. **GET raiz com paginacao**: Adicionar query params `pagina`, `registros_por_pagina`, `filtrar_por_status`.
15. **Deduplicar registrar-pagamento vs lancar-pagamento**: Deprecar `/registrar-pagamento` (interno) e usar apenas `/lancar-pagamento` (Huggs-style).

### Fase 3 — Deploy e Testes

16. Deploy das 3 Edge Functions alteradas.
17. Testes bilaterais via `curl_edge_functions` nos endpoints corrigidos.

## Arquivos Alterados

| Arquivo | Tipo de Alteracao |
|---|---|
| `supabase/functions/contas-pagar-api/index.ts` | Governanca de status, validacao Zod, webhooks, idempotencia |
| `supabase/functions/erp-webhook-inbound/index.ts` | Fix status em baixa_confirmada |
| `supabase/functions/auditoria-contas-pagar/index.ts` | Auth JWT obrigatorio |

