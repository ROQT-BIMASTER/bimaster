## Plano: Envio de Pagamentos para o ERP

### Status: ✅ Implementado

### O que foi feito

1. **Tabela `erp_export_queue`** — Criada com RLS restrita via `can_access_payment_queue`
2. **Edge Function `erp-export-payment`** — 3 canais: N8N webhook, REST API, SQL Direct (placeholder)
3. **Trigger automático** — Ao marcar como pago no `useFinancialPaymentQueue`, exporta automaticamente
4. **Badge visual** — `ErpExportStatusBadge` no `PaymentReviewDialog` com status e botão reenviar
5. **Helper `useErpExport.ts`** — Função reutilizável para exportar pagamentos

### Secrets necessárias (conforme canal)
- `N8N_ERP_EXPORT_WEBHOOK_URL` — para canal N8N
- `ERP_REST_API_URL` + `ERP_REST_API_KEY` — para canal REST API
- `ERP_SQL_HOST` — para canal SQL Direct (não implementado ainda)

---

## Plano: API de Exportação Pull para o ERP

### Status: ✅ Implementado

### O que foi feito

1. **Edge Function `contas-pagar-export-api`** — API Pull com 3 endpoints:
   - `GET /paid` — Lista pagamentos pagos pendentes de exportação (payload limpo, sem códigos internos)
   - `POST /confirm` — ERP confirma recebimento dos pagamentos
   - `GET /status` — Estatísticas de sincronização
2. **Payload limpo** — Métodos de pagamento mapeados para nomes legíveis (PIX, TED, Boleto, etc.)
3. **Autenticação via `x-api-key`** — Usa secret `EXPORT_API_KEY` já existente
4. **Documentação** — `docs/API_EXPORT_PAGAMENTOS.md` com exemplos completos para a equipe do ERP
5. **erp-export-payment atualizado** — Payload sem códigos internos (`payment_details`, `code` removidos)

---

## Plano: Fluxo Profissional de Contas a Pagar — Provisão + Baixa (Padrão SAP/TOTVS)

### Status: ✅ Implementado

### O que foi feito

1. **Migration** — Adicionada coluna `export_type` em `erp_export_queue` (`registration` | `payment`) com constraints atualizadas
2. **Edge Function `erp-export-payment`** — Payload dinâmico por tipo:
   - `registration`: status "Aguardando Pagamento", sem dados de pagamento
   - `payment`: status "Pago", com método e data de pagamento
3. **Edge Function `contas-pagar-export-api`** — Pull API expandida:
   - `GET /pending` — Itens aceitos pendentes de provisão
   - `GET /paid` — Itens pagos pendentes de baixa
   - `GET /` — Ambos, com filtro `?status=accepted,paid`
   - `POST /confirm` — Aceita `export_type` para confirmar provisão ou baixa separadamente
   - `GET /status` — Contagens separadas para provisão e baixa
4. **Hook `useErpExport.ts`** — Parâmetro `exportType` adicionado
5. **Hook `useFinancialPaymentQueue.ts`** — Triggers automáticos:
   - Ao aceitar: exporta como `registration` (provisão)
   - Ao pagar: exporta como `payment` (baixa)

### Fluxo

```text
Lançamento → Aprovação → ERP: "Aguardando Pagamento" (provisão)
                              ↓
             Pagamento → ERP: "Pago" (baixa do título)
```

---

## Plano: Expansão Completa da Integração Pluggy (sem Pagamentos)

### Status: ✅ Implementado

### O que foi feito

#### FASE 1 — Infraestrutura Base
1. **Migration** — 6 novas tabelas + 2 alteradas:
   - `pluggy_investments` — Investimentos corporativos
   - `pluggy_investment_transactions` — Movimentações de investimento
   - `pluggy_identities` — Identidade do titular (CPF/CNPJ)
   - `pluggy_loans` — Empréstimos ativos
   - `pluggy_category_rules` — Regras de categorização customizadas
   - `balance_alerts` — Alertas de saldo baixo
   - `bank_connections` — +5 colunas (account_type, credit_limit, etc.)
   - `conciliacoes_bancarias` — +4 colunas (pluggy_category, payment_data, etc.)
   - RLS em todas as tabelas via user_id / bank_connections join

2. **Edge Function `conciliacao-bancaria`** — +13 novos actions:
   - `list-connectors`, `fetch-identity`, `fetch-investments`, `fetch-investment_detail`
   - `fetch-investment-transactions`, `fetch-accounts`, `fetch-categories`
   - `create-category-rule`, `list-category-rules`, `delete-category-rule`
   - `manage-balance-alert`, `list-balance-alerts`, `register-webhook`

#### FASE 2 — Webhook Avançado
3. **`pluggy-webhook`** expandido:
   - `transactions/created` → Sincronização incremental automática
   - `item/updated` → Auto-sync + atualização de saldo + verificação de alertas
   - `connector/status_updated` → Log informacional
   - Auto-registro de webhooks ao salvar conexão

#### FASE 3 — Dashboards e UI
4. **Nova página `InvestimentosCorporativos`** — Dashboard com:
   - Cards de patrimônio total, tipos de aplicação, filiais
   - Gráfico de composição da carteira (PieChart)
   - Tabela detalhada com nome, tipo, emissor, saldo, taxa, vencimento, status
   - Sync por conexão bancária

5. **Novos componentes na Conciliação Bancária** (novas tabs):
   - `PainelCartoes` — Cartões de crédito com limite, utilizado, disponível, fatura
   - `MonitorEmprestimos` — Empréstimos ativos com saldo devedor, parcelas, juros, progress
   - `GestaoCategoriasPluggy` — Criar/remover regras de categorização com vínculo ao plano de contas
   - `AlertasSaldo` — Configurar alertas de saldo mínimo por conta

6. **Sidebar** — Links para Conciliação Bancária e Investimentos no módulo Financeiro

#### FASE 4 — Automações Inteligentes
7. **DRE Automático** — `autoMapCategories` no sync mapeia categorias Pluggy → plano de contas
8. **Conciliação Automática via Webhook** — Matching em 3 tiers no `pluggy-webhook`
9. **Alertas de Saldo Baixo** — Verificação automática pós-sync com threshold configurável
10. **Categorização em transações** — Salva `pluggy_category`, `pluggy_category_id`, `payment_data`

---

## Plano: Fluxo de Onboarding de Produto Importado (China → Brasil)

### Status: ✅ Fase 1-3 Implementadas

### O que foi feito

1. **Migration** — 3 novas tabelas: `produtos_brasil`, `produto_brasil_skus`, `produto_brasil_checklist` com RLS
2. **Botão Voltar** — Adicionado em `ProjetoVincularChina.tsx` com `useNavigate(-1)`
3. **Automação pós-vínculo** — Ao vincular submissão China, cria automaticamente registro em `produtos_brasil` com snapshot dos dados + popula checklist regulatório com 7 itens padrão
4. **Página ProdutoBrasilCadastro** — `/dashboard/projetos/produto-brasil/:id` com:
   - Status Pipeline visual (6 etapas)
   - Coluna China (somente leitura) x Coluna Brasil (editável)
   - Botão "Copiar dados da China"
   - Destaque visual para campos divergentes (borda amarela)
   - Tabela de SKUs/variações (adicionar/remover inline)
   - Checklist regulatório colapsável com campos extras (registro, ANVISA, categoria, responsável técnico)
   - Transições de status: Enviar para Regulatório, Aprovar Produto
5. **Hook `useProdutoBrasil.ts`** — CRUD completo para produtos_brasil, SKUs, checklist

### Status do produto no fluxo
`produto_importado` → `aguardando_precadastro` → `precadastro_em_andamento` → `aguardando_regulatorio` → `aprovado_cadastro` → `produto_ativo`

---

## Plano: Proteção DDoS — Camada Aplicacional (L7)

### Status: ✅ Implementado

### O que foi feito

1. **Tabela `ddos_rate_limits`** — Rate limiting persistente com índices e cleanup automático, RLS restrita a service_role
2. **Edge Function `ddos-shield`** — 3 actions:
   - `check` — Verifica se requisição é permitida (por user_id ou IP)
   - `cleanup` — Remove registros expirados
   - `status` — Estatísticas de IPs/usuários bloqueados
3. **Hook `useDDoSProtection`** — Interceptor frontend para respostas 429 com backoff exponencial
4. **Relatório de Segurança** — DDoS movido de "Risco Médio" para "✅ Implementado"

### Limites configurados
- **Anônimo (IP)**: 60 req/min
- **Autenticado (user_id)**: 120 req/min
- **Departamento China**: 240 req/min (2x)
- **Uploads**: Excluídos do rate limiting
- **Bloqueio**: 5 minutos ao exceder limite
