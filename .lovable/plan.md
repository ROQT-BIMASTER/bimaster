

## Diagnóstico — Onda 2 tem 1 bug bloqueante de produção

Antes de planejar, validei cada item da spec contra o estado real do código + schema real do banco. Encontrei **1 bug crítico que vai bloquear 2C/2D/2E inteiros**, **2 ajustes de paridade legítimos**, e a maior parte da "Onda 2" já está implementada e funciona.

### Validação item-a-item

| Item | Status real | Ação |
|---|---|---|
| **2A — Consultar** | `handleConsultar` aceita id/cod_integracao/cod_huggs, retorna 404 com mensagem clara. | **N/A** — só validar via curl |
| **2B — Alterar (PUT /update)** | `/alterar` foi removido em v4.0.0 (PR-7). `/update` substituto existe e funciona, mas **NÃO valida referências** (categoria_codigo nova pode quebrar). | **FAZER** — adicionar `validateReference` em `/update` |
| **2C — Lancar pagamento** | **BUG CRÍTICO**: RPC `process_payment_atomic` grava em `pagamentos.metodo_pagamento` e `pagamentos.baixa_origem` (e em `contas_pagar.baixa_origem`/`conciliar_documento`/`codigo_baixa_integracao`) — nenhuma dessas colunas existe. Tabela tem `forma_pagamento`, `observacoes` (plural). **Qualquer chamada a `/lancar-pagamento` quebra com erro PG**. | **FAZER** — fix do RPC |
| **2D — Cancelar pagamento** | Endpoint `/cancelar-pagamento` foi removido em v4.0.0. Spec marca como deprecated mas pede teste. Único caminho de reversão = `/estornar`. | **N/A** — documentar ausência |
| **2E — Estornar** | Lógica correta, valida motivo via Zod, recalcula valores. Mas depende do título estar com `status='pago'` ou `'parcial'` — só funciona se 2C funcionar. | **N/A** após fix do 2C |
| **2F — Excluir** | Soft delete via `status='cancelado'`. Bloqueia título 'pago' com codigo_status='3'. Funciona. | **N/A** |
| **2G — Cancelar título** | `handleCancelar` aceita batch via `ids[]`, exige motivo. Mas **filtra silenciosamente** títulos com `status='pago'` (linha 156: `.not('status', 'eq', 'pago')`) — não devolve erro granular como spec pede. | **MELHORAR** — devolver lista de skipped com motivo |
| **2H — Upsert-lote** | Já tem validação granular por item (PR-12). Resposta inclui `errosDetalhe[]`. | **N/A** |

### Detalhe do bug crítico (2C)

```
Tabela `pagamentos` real:        RPC tenta gravar:
  forma_pagamento                  metodo_pagamento     ❌ não existe
  observacoes                      observacao           ❌ não existe (singular)
  conta_bancaria_id                baixa_origem         ❌ não existe
  parcela_id                       (—)
```

E em `UPDATE contas_pagar`:
```
baixa_origem                       ❌ não existe (verificar)
conciliar_documento                ❌ não existe (verificar)
codigo_baixa_integracao            ❌ não existe (verificar)
valor_juros, valor_desconto        ✅ existem
```

**Resultado**: o checklist 2C ("Pagamento total: liquidado 'S'") não tem como passar até o RPC ser corrigido. E como 2D/2E dependem de um título pago para testar, eles também ficam bloqueados.

## Plano de execução

### Fase A — Fix do RPC `process_payment_atomic` (BLOQUEANTE)

Migration que recria o RPC com mapeamento correto:
- `pagamentos.metodo_pagamento` → `forma_pagamento`
- `pagamentos.observacao` → `observacoes`
- Remover `baixa_origem` do INSERT em `pagamentos` (coluna não existe nessa tabela).
- Em `UPDATE contas_pagar`: verificar quais colunas (`baixa_origem`, `conciliar_documento`, `codigo_baixa_integracao`) existem; remover do UPDATE as que não existirem; se existirem, manter.

Vou conferir antes de gravar (uma SQL extra) quais dessas 3 colunas existem em `contas_pagar`. Se nenhuma existir, simplifico o UPDATE drasticamente.

### Fase B — Validação de referência em `/update` (paridade com `/incluir` e `/upsert`)

Em `handleUpdate` (`crud-handlers.ts` linhas 109-142), antes do `.update()`:
- Se `categoria_codigo` está nas updates, chamar `validateReference(... trade_chart_of_accounts, 'code', ...)`.
- Se `codigo_cliente_fornecedor` ou `fornecedor_codigo` estão nas updates, chamar `validateReference(... fornecedores, 'erp_code', ...)`.
- Retornar 400 estruturado se inválido.

### Fase C — Erro granular em `/cancelar` batch (2G)

Em `handleCancelar` (linhas 144-169):
- Trocar o filtro `.not('status', 'eq', 'pago')` por: buscar todos os IDs primeiro, separar entre canceláveis e bloqueados (status='pago'), retornar resposta com `cancelados[]`, `bloqueados[]` (cada um com motivo "título já pago").
- Mantém compatibilidade: `cancelados` continua sendo o count de sucesso.

### Fase D — Versionamento + regression

- Bump `APP_VERSION` `3.1.4 → 3.1.5` em `src/lib/version.ts`.
- 4 invariantes novos em `audit/regression-greps.sh`:
  - RPC migration grep: `forma_pagamento` ≥1 e `metodo_pagamento` ≤0 no SQL recriado.
  - `validateReference.*categoria` aparece em `handleUpdate` (≥1).
  - `bloqueados` aparece em `handleCancelar` (resposta granular).
  - `pagamentos.observacoes` (plural) referenciado nas migrations recentes.
- Atualizar `docs/fixes-abr26/IMPLEMENTATION_REPORT.md` com seção PR-13 / Onda 2.

### Fase E — Validação E2E

Smoke via `supabase--curl_edge_functions` (em ordem):
1. `GET /consultar?codigo_lancamento_integracao=...` → 200 com `conta_pagar_cadastro`.
2. `GET /consultar?codigo_lancamento_integracao=NAOEXISTE` → 404.
3. `POST /upsert` (criar título R$ 500) → 200.
4. `POST /lancar-pagamento` valor=500 → 200, `liquidado:'S'`, `valor_baixado:500`. **(antes do fix isto era 500 PG)**.
5. `GET /consultar` → status='pago'.
6. `POST /estornar` motivo=teste → 200, status volta a 'pendente'.
7. `POST /upsert` (criar título R$ 1000), `lancar-pagamento` 600 → liquidado:'N'; depois 400 → liquidado:'S'.
8. `POST /upsert` (R$ 200), `lancar-pagamento` valor=180/desconto=20/juros=5/multa=3 → 200 (líquido = 168).
9. `POST /lancar-pagamento` valor=0 → 400 "valor é obrigatório".
10. `POST /lancar-pagamento` para título inexistente → 404.
11. `PUT /update` mudando `categoria_codigo` para inexistente → 400 "Categoria não encontrada".
12. `POST /cancelar` com 2 ids (1 pendente, 1 pago) → resposta com `cancelados:[id1]`, `bloqueados:[{id:id2, motivo:"já pago"}]`.
13. `POST /upsert-lote` 3 itens (1 com fornecedor inválido) → `total_processados:2, total_erros:1, erros[]` granular.
14. `DELETE /excluir` título pago → 400 codigo_status:'3'.

## Não-escopo

- Reativar `/cancelar-pagamento` (foi removido em PR-7 propositadamente; spec marca como deprecated; substituto `/estornar` cobre o caso).
- Reativar `/alterar` (mesmo caso, `/update` é substituto).
- Mexer em `ContasAPagar.tsx`, `ContasPagarGestao.tsx`, etc. (regra explícita do usuário).
- SDK / OpenAPI bumps (sem mudança de contrato externo — só comportamento interno mais correto).
- Adicionar coluna `baixa_origem`/`conciliar_documento`/`codigo_baixa_integracao` em `pagamentos` se elas faltarem (escopo Onda 3 se virar requisito do ERP).

## Impacto

3 arquivos editados (`crud-handlers.ts`, `src/lib/version.ts`, `audit/regression-greps.sh`) + 1 migration SQL para o RPC. ~80 linhas mudadas. 4 invariantes novos. Bump de patch (`3.1.5`). Risco de regressão: muito baixo — fix do RPC só corrige bug pré-existente; as melhorias em `/update` e `/cancelar` são pré-validações puras que não alteram o caminho feliz.

