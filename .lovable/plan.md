

# Análise Completa — Portal de Integração ERP (Documentação para o ERP)

## Situação Atual

O portal documenta **30 APIs** organizadas em 4 módulos (Geral, Cadastros Auxiliares, Finanças, Complementar). Nenhuma referência a N8N foi encontrada na documentação — isso está correto.

## APIs com Edge Functions criadas MAS não documentadas no Portal

Estas são APIs ERP-relevantes que já existem como edge functions mas não aparecem na documentação:

| Edge Function | Descrição | Rotas Implementadas | Precisa Documentar? |
|---|---|---|---|
| `erp-fornecedores-query` | Consulta fornecedores por CNPJ | GET / (com filtro cnpj) | **SIM** — essencial para o ERP |
| `erp-fornecedores-sync` | Sync bidirecional de fornecedores com ERP | CRUD completo (338 linhas) | **SIM** — essencial para o ERP |
| `erp-plano-contas-api` | Plano de contas (chart of accounts) | GET / (listar ativos) | **SIM** — essencial para o ERP |
| `erp-portadores-api` | Portadores/contas bancárias para ERP | GET /, POST /sync | **SIM** — essencial para o ERP |
| `webhook-subscriptions-api` | CRUD de assinaturas webhook outbound | /listar, /consultar, /incluir, /alterar, /excluir, /testar, /eventos, /status | **SIM** — o ERP precisa gerenciar seus webhooks |
| `webhook-dispatcher` | Processador da fila de webhooks | POST / (internal processing) | **SIM** — complementa o webhook-subscriptions |
| `erp-export-payment` | Exporta pagamentos para fila ERP | POST (action: export/status/pending/confirm) | Já parcialmente coberto em "Exportação ERP" mas falta a API direta |
| `conciliacao-bancaria` | Conciliação bancária via Pluggy | Múltiplas rotas | **NÃO** — é interna (Pluggy), não para o ERP |
| `fiscal-iva-api` | Cálculos fiscais IVA | POST / | **OPCIONAL** — depende se o ERP precisa |

## APIs Documentadas SEM Edge Function criada

Estas APIs aparecem no portal mas **não têm edge function implementada**:

| API Documentada | basePath | Status |
|---|---|---|
| Boletos | `/boletos-api` | ✅ Edge function existe |
| Contas Correntes | `/contas-correntes-api` | ✅ Existe |
| Lançamentos CC | `/lancamentos-cc-api` | ✅ Existe |
| Orçamentos de Caixa | `/orcamentos-caixa-api` | ✅ Existe |
| Pesquisar Lançamentos | `/pesquisar-lancamentos-api` | ✅ Existe |
| Movimentos Financeiros | `/movimentos-financeiros-api` | ✅ Existe |
| Resumo Financeiro | `/resumo-financeiro-api` | ✅ Existe |

Todas as APIs documentadas têm suas edge functions criadas.

## Rotas Documentadas vs Implementadas — Verificação por API

As rotas de integração Huggs em `contas-pagar-api` (consultar, incluir, alterar, excluir, upsert, upsert-lote, lancar-pagamento, cancelar-pagamento, listar) estão **todas implementadas** na edge function (linhas 1711-2262).

## Plano de Ação

### Parte 1 — Adicionar 6 APIs faltantes ao Portal

Adicionar ao `ApiDocumentation.tsx`:

1. **Fornecedores (Query)** — `/erp-fornecedores-query`
   - GET / (listar ativos, filtro por CNPJ)

2. **Fornecedores (Sync)** — `/erp-fornecedores-sync`
   - CRUD completo para sync bidirecional

3. **Plano de Contas** — `/erp-plano-contas-api`
   - GET / (listar contas ativas)

4. **Portadores** — `/erp-portadores-api`
   - GET / (listar por empresa)
   - POST /sync (upsert em massa)

5. **Webhook Subscriptions** — `/webhook-subscriptions-api`
   - GET /eventos (listar eventos disponíveis)
   - GET /listar (listar assinaturas)
   - GET /consultar (consultar por ID)
   - POST /incluir (criar assinatura)
   - PUT /alterar (atualizar)
   - DELETE /excluir (remover)
   - POST /testar (enviar evento teste)
   - GET /status (health check)

6. **Webhook Dispatcher** — `/webhook-dispatcher`
   - POST / (processar fila de eventos)
   - GET /status (health check)

### Parte 2 — Organização dos Módulos

Adicionar as APIs nos módulos corretos:
- **Geral**: Fornecedores Query + Sync (junto com Clientes)
- **Cadastros Auxiliares**: Plano de Contas, Portadores
- **Complementar**: Webhook Subscriptions, Webhook Dispatcher (junto com o Inbound existente)

### Parte 3 — Atualizar ApiTester

Verificar se os endpoints pré-configurados do `ApiTester.tsx` incluem as novas APIs.

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `src/components/erp/ApiDocumentation.tsx` | Adicionar 6 APIs (endpoints + módulos) |
| `src/components/erp/ApiTester.tsx` | Adicionar endpoints pré-configurados das novas APIs |

## Resumo

- **0 APIs N8N** no portal (correto)
- **6 APIs faltantes** para documentar (fornecedores, plano de contas, portadores, webhooks)
- **Todas as rotas documentadas têm edge functions** implementadas
- **Nenhuma edge function ERP-relevante** sem implementação

