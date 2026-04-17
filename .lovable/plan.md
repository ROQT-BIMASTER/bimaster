

## Diagnóstico

Pedido: validar end-to-end que **todas as APIs e endpoints documentados** estão no ar e respondendo conforme a documentação. Não é pedido de código novo — é auditoria executiva de saúde de superfície.

Preciso enumerar:
1. Universo completo de edge functions deployadas (já tenho lista parcial via logs: ~40 functions).
2. Para cada função, quais rotas estão documentadas (OpenAPI em `ApiDocumentation.tsx` + arquivos `docs/API_*.md`).
3. Health check (`/status`) de cada uma.
4. Smoke test de pelo menos 1 rota canônica por função (priorizando CP/CR pós PR-7).
5. Verificar que rotas removidas (`/listar`, `/alterar`, `/registrar-pagamento`, `/cancelar-pagamento`, `/cancelar-recebimento`) retornam **404** (invariante negativo).
6. Cruzar com `regression-greps.sh` (38/38) e relatório do `api-health-check`.

## Inventário rápido (do contexto + logs)

Functions vistas: `paises-api`, `projetos-api`, `origens-api`, `tipos-entrega-api`, `bandeiras-api`, `resumo-financeiro-api`, `orcamentos-caixa-api`, `categorias-api`, `clientes-api`, `erp-webhook-inbound`, `erp-fornecedores-query`, `erp-fornecedores-sync`, `contas-correntes-api`, `finalidades-transferencia-api`, `contas-pagar-export-api`, `contas-pagar-api`, `parcelas-api`, `cnae-api`, `anexos-api`, `cidades-api`, `tipos-atividade-api`, `dre-cadastro-api`, `tipos-anexo-api`, `erp-export-payment`, `departamentos-api`, `lancamentos-cc-api`, `empresas-api`, `erp-plano-contas-api`, `api-health-check`, `webhook-dispatcher`, `movimentos-financeiros-api`, `bancos-api`, `erp-portadores-api`, `contas-receber-api`, `boletos-api`, `webhook-subscriptions-api`, `tipos-documento-api`, `pesquisar-lancamentos-api`. Total ~38.

## Plano de execução — auditoria em 5 fases

### Fase 1 — Inventário canônico (read-only)
- `code--view src/components/erp/ApiDocumentation.tsx` (seções endpoints v4.0.0) para extrair lista oficial de paths por função.
- `code--list_dir supabase/functions/` para cruzar com o que está deployado.
- `code--view supabase/functions/api-health-check/index.ts` para entender critério de "OK/missing/inactive".

### Fase 2 — Health check global automatizado
- `supabase--curl_edge_functions path=/api-health-check method=POST` → consome o relatório oficial do próprio sistema. Retorna `{ok: [], missing: [], inactive: []}`.
- Esperado: `missing.length == 0` e `inactive.length == 0`.

### Fase 3 — Smoke test por categoria (paralelo onde possível)
Para cada grupo, validar 1 rota canônica + `/status`:

| Grupo | Functions | Rota smoke |
|---|---|---|
| **Financeiro core (PR-7 hotzone)** | `contas-pagar-api`, `contas-receber-api` | `GET /status`, `GET /query?limit=1` |
| **Financeiro auxiliar** | `parcelas-api`, `boletos-api`, `movimentos-financeiros-api`, `lancamentos-cc-api`, `pesquisar-lancamentos-api`, `resumo-financeiro-api`, `orcamentos-caixa-api`, `contas-correntes-api`, `dre-cadastro-api` | `GET /status` + `GET /listar?...` (legítimo nessas APIs) |
| **Cadastros lookup** | `bancos-api`, `bandeiras-api`, `cidades-api`, `paises-api`, `categorias-api`, `cnae-api`, `tipos-*`, `finalidades-transferencia-api`, `origens-api`, `departamentos-api`, `empresas-api` | `GET /status`, `GET /listar?registros_por_pagina=1` |
| **Negócio** | `clientes-api`, `projetos-api`, `anexos-api` | `GET /status` |
| **ERP integration** | `erp-fornecedores-query`, `erp-fornecedores-sync`, `erp-plano-contas-api`, `erp-portadores-api`, `erp-export-payment`, `erp-webhook-inbound`, `contas-pagar-export-api` | `GET /status` |
| **Webhook infra** | `webhook-dispatcher`, `webhook-subscriptions-api` | `GET /status` |

### Fase 4 — Invariantes negativos PR-7 (regressão)
Confirmar que rotas removidas retornam **404**:
- `GET /contas-pagar-api/listar` → 404
- `PUT /contas-pagar-api/alterar` → 404
- `POST /contas-pagar-api/registrar-pagamento` → 404
- `POST /contas-pagar-api/cancelar-pagamento` → 404
- `GET /contas-receber-api/listar` → 404
- `PUT /contas-receber-api/alterar` → 404
- `POST /contas-receber-api/cancelar-recebimento` → 404

### Fase 5 — Relatório consolidado
Tabela executiva ao final: 
- Coluna `Function`, `/status`, `Smoke canônico`, `Versão`, `Observações`.
- Resumo: `OK / Falhou / Não testado`.
- Verde se ≥95% das functions retornam 200 em `/status` + 100% das rotas removidas em 404.
- Bônus: rodar `audit/regression-greps.sh` (38/38) e citar resultado.

## Não-escopo

- Mudanças de código, deploy novo, criação de testes Deno persistentes.
- Auditoria de RLS, performance, latência (escopo separado).
- Functions internas sem rota HTTP pública (se houver).

## Impacto

Confirma em ~10 minutos (curl paralelo) que a superfície pública da API está 100% funcional pós PR-7. Entrega documental: tabela `Function × Status` que pode ser anexada como evidência de release v3.0.1. Custo zero em código — só leitura + curl. Se algo retornar 5xx ou 404 em rota que deveria responder, abro plano de correção pontual no follow-up.

