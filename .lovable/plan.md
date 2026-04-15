

# Analise de Producao — Bloqueadores para Integracao com Empresas Externas

## BLOQUEADORES CRITICOS (impedem uso em producao)

### 1. `contas-receber-api` — `checkRateLimit` com assinatura errada (CRASH)
**Linha 128**: `await checkRateLimit(rateLimitKey, 60, 60)` — passa 3 argumentos string/number. A funcao `_shared/rate-limit.ts` espera 1 argumento objeto `{ prefix, limit, req, userId }`. **Resultado: TypeError em runtime, TODOS os endpoints do CR crasham** exceto `/status`. Isso explica o erro 500 reportado nos testes anteriores.

**Correcao**: Alterar para `await checkRateLimit({ prefix: 'cr-api', limit: 60, req, userId: auth.userId })`.

### 2. `contas-pagar-api` — `enqueueWebhookEvent` com assinatura errada (CRASH silencioso)
**Linhas 1508, 2016, 2098, 2393**: Chamam `enqueueWebhookEvent('evento', payload)` com 2 argumentos. A funcao `_shared/webhook-enqueue.ts` espera `(evento: string, payload: object, empresaId?)`. O primeiro argumento `evento` recebe a string do evento — OK. MAS no `cancelar` (linha 1508) e nos demais, o `supabase` client nao e passado. A funcao cria seu proprio client, entao isso funciona. **Porem**: nenhum `empresaId` e passado, entao todos os webhooks sao enfileirados sem empresa — os subscribers nao recebem por filtro de empresa.

**Correcao**: Adicionar `empresaId` como terceiro argumento em todas as chamadas de webhook do CP.

### 3. `contas-receber-api` — `/status` exige autenticacao
**Linha 112-113**: `const auth = await validateAnyAuth(req)` e executado ANTES do check `/status`. Um health check externo (monitoramento, load balancer, Postman) nao consegue verificar se a API esta online sem credenciais. O CP `/status` nao exige auth (correto). **Inconsistencia bloqueante para integradores.**

**Correcao**: Mover o bloco `/status` para antes da autenticacao.

### 4. `contas-receber-api` — `/alterar` e `/excluir` sem governanca de status
Nao ha verificacao se o titulo esta `Liquidado` ou `Cancelado` antes de permitir alteracao/exclusao. O CP tem essa governanca (adicionada na iteracao anterior). CR esta sem.

**Correcao**: Adicionar checks de status identicos aos do CP.

### 5. `contas-receber-api` — `/cancelar` permite cancelar titulo liquidado
Linha 417: seta `status: 'Cancelado'` sem verificar status atual. Um titulo ja recebido pode ser cancelado, corrompendo saldos.

**Correcao**: Rejeitar se status = 'Liquidado'.

### 6. `contas-pagar-api` — `/status` expoe config interna
Linha 588-599: Retorna `rate_limiting.max_concurrent_syncs`, `active_syncs`, `available_slots`. Informacao util para atacantes calibrarem carga. Ja identificado antes mas nao corrigido.

**Correcao**: Remover `rate_limiting` do response de `/status`. Manter apenas `status`, `version`, `timestamp`.

### 7. `contas-receber-api` — Upsert usa `onConflict: 'codigo_lancamento_integracao'` mas constraint real e `(empresa_id, codigo_lancamento_integracao)`
**Linhas 268, 314**: O upsert falhara se `empresa_id` for null (constraint parcial exige `codigo_lancamento_integracao IS NOT NULL`, mas `empresa_id` tambem faz parte). Se duas empresas usarem o mesmo `codigo_lancamento_integracao`, havera conflito errado.

**Correcao**: Alterar `onConflict` para `'empresa_id,codigo_lancamento_integracao'` (igual ao CP).

### 8. `contas-receber-api` — `/cancelar-recebimento`, `/conciliar`, `/desconciliar` sao stubs
**Linhas 384-408**: Retornam `codigo_status: '0'` sem fazer nada no banco. Um integrador acha que cancelou um recebimento mas nada mudou. **Bloqueante para producao financeira.**

**Correcao**: Implementar logica real ou retornar `501 Not Implemented` com mensagem clara.

### 9. `contas-receber-api` — `/sync` e `/bulk-sync` sem validacao Zod no body
**Linhas 480-541**: Aceitam qualquer campo via spread (`...r`) sem schema. Violacao de mass assignment. O CP tem protecao equivalente via `processRecordsWithRetry` + `transformErpData`.

**Correcao**: Adicionar schema de validacao ou filtro de campos permitidos.

---

## PROBLEMAS DE MEDIO RISCO

**10.** CP `/update` (PUT) aceita campos via allowlist manual mas nao usa Zod — inconsistente com o resto.
**11.** CR nao tem sanitizacao em `/sync` (campos como `cliente_nome` vao direto ao banco sem `sanitizeString`).
**12.** CP `parseDate` (linha 290) aceita `new Date("abc")` silenciosamente — retorna null sem erro.
**13.** CR `/listar` usa `Number(cliente)` para filtro — se o integrador enviar UUID, falha silenciosamente.

---

## PLANO DE CORRECAO (3 arquivos)

| Arquivo | Correcoes |
|---|---|
| `supabase/functions/contas-receber-api/index.ts` | #1 checkRateLimit, #3 status sem auth, #4 governanca, #5 cancelar, #7 onConflict, #8 stubs, #9 sync |
| `supabase/functions/contas-pagar-api/index.ts` | #2 webhook empresaId, #6 status sanitizado |
| — | Testes bilaterais pos-deploy |

### Detalhes por correcao

**CR — checkRateLimit (#1)**:
```typescript
// ANTES (crash):
await checkRateLimit(rateLimitKey, 60, 60);
// DEPOIS:
await checkRateLimit({ prefix: 'cr-api', limit: 60, req, userId: auth.userId });
```

**CR — /status antes de auth (#3)**:
Mover o bloco `if (path.endsWith('/status'))` para ANTES de `validateAnyAuth`.

**CR — governanca de status (#4, #5)**:
Em `/alterar`, `/excluir`, `/cancelar`: buscar titulo, verificar status, rejeitar se Liquidado/Cancelado.

**CR — onConflict (#7)**:
```typescript
// ANTES:
.upsert(upsertData, { onConflict: 'codigo_lancamento_integracao' })
// DEPOIS:
.upsert(upsertData, { onConflict: 'empresa_id,codigo_lancamento_integracao' })
```

**CR — stubs (#8)**:
Retornar `501 Not Implemented` com corpo `{ codigo_status: '99', descricao_status: 'Endpoint em desenvolvimento' }`.

**CP — webhook empresaId (#2)**:
Extrair `empresa_id` do titulo e passar como 3o argumento.

**CP — status sanitizado (#6)**:
Remover `rate_limiting` do response.

### Testes pos-deploy
- CR: status (sem auth), incluir, listar, alterar (gov), cancelar (gov)
- CP: status, incluir, alterar (gov)

