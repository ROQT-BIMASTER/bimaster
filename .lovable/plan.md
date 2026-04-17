

## Diagnóstico

Pedido: validar end-to-end pós PR-8 (SDK v3.1.0 / OpenAPI v4.1.0 / APP v3.1.0) que **toda a superfície de API está funcional** e que as 3 features novas (HMAC helper, classes de erro JS, cache API) não introduziram regressão.

PR-8 mudou apenas conteúdo de strings dentro de `SdkDownloadButtons.tsx` (texto dos SDKs gerados como download), `ApiDocumentation.tsx` (versão OpenAPI 4.1.0), `version.ts` (3.1.0) e `regression-greps.sh` (43 invariantes). **Nenhuma edge function foi tocada**. Logo o risco de runtime é zero — mas o usuário pediu validação, então vou rodar a auditoria completa em modo executivo.

## Plano de execução — auditoria completa em 5 fases

### Fase 1 — Regression script (gate primário)
- `code--exec bash audit/regression-greps.sh` → esperado **43/43 OK**.
- Falha aqui = parar e reportar. Cobre: paridade SDK 3 linguagens, versões alinhadas (OpenAPI 4.1.0 + SDK 3.1.0 + APP 3.1.0), HMAC helper presente, classes erro JS, cache API, matriz de cobertura, invariantes negativos PR-7 (rotas removidas em docs).

### Fase 2 — Health check global
- `supabase--curl_edge_functions path=/api-health-check method=POST` → relatório oficial das ~38 functions deployadas.
- Esperado: `missing.length == 0`, `inactive.length == 0`.

### Fase 3 — Smoke test PR-7 hotzone (CP/CR)
Em paralelo via `supabase--curl_edge_functions`:
- `GET /contas-pagar-api/status` → 200 (versão atual)
- `GET /contas-pagar-api/query?limit=1` → 200 com `x-api-key`
- `GET /contas-receber-api/status` → 200
- `GET /contas-receber-api/query?limit=1` → 200

### Fase 4 — Invariantes negativos PR-7 (rotas removidas)
Confirmar que retornam **404** (não devem ter ressuscitado):
- `GET /contas-pagar-api/listar`
- `PUT /contas-pagar-api/alterar`
- `POST /contas-pagar-api/registrar-pagamento`
- `POST /contas-pagar-api/cancelar-pagamento`
- `GET /contas-receber-api/listar`
- `PUT /contas-receber-api/alterar`
- `POST /contas-receber-api/cancelar-recebimento`

### Fase 5 — Smoke por categoria (paralelo, /status only)
~30 functions restantes — só `GET /status` para confirmar que estão no ar:
- **Lookups**: bancos, bandeiras, cidades, paises, cnae, categorias, tipos-anexo, tipos-atividade, tipos-documento, tipos-entrega, finalidades-transferencia, origens, departamentos, empresas
- **Financeiro auxiliar**: parcelas, boletos, movimentos-financeiros, lancamentos-cc, pesquisar-lancamentos, resumo-financeiro, orcamentos-caixa, contas-correntes, dre-cadastro
- **Negócio**: clientes, projetos, anexos, fornecedores
- **ERP integration**: erp-fornecedores-query, erp-fornecedores-sync, erp-plano-contas-api, erp-portadores-api, erp-export-payment, erp-webhook-inbound, contas-pagar-export-api
- **Webhook infra**: webhook-dispatcher, webhook-subscriptions-api

### Fase 6 — Relatório final
Tabela `Function × /status × Smoke × Versão`. Resumo executivo: invariantes 43/43, health check N/N OK, rotas removidas 7/7 em 404, ~38 functions ativas. Verde se ≥95% retornam 200/401/405 em `/status` (401/405 é ativo — só rejeitando auth/método).

## Não-escopo

- Mudanças de código (esta auditoria é read-only operacional).
- Validação UI do Portal ERP no browser (já validado nos PRs anteriores).
- Performance/latência (escopo separado).

## Impacto

Confirma em ~5 minutos que o PR-8 v3.1.0 está cleanly deployed: SDKs novos baixáveis, versões alinhadas, backend intacto, rotas removidas continuam 404, regression script verde. Custo zero em código. Se algo falhar, abro plano corretivo pontual no follow-up.

