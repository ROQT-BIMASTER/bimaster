# Módulo: Financeiro

> **Última atualização:** 2026-03-21 | **Versão:** 2.0.0

---

## 1. Visão Geral

O módulo Financeiro centraliza Contas a Pagar, Contas a Receber, Plano de Contas, DRE Analítico, Fluxo de Caixa, Saldos Bancários, Conciliação e Central de Pagamentos.

- **Guard de Módulo**: `moduleCode="financeiro"`
- **Guard de Telas**: Telas críticas usam `screenCode` específico
- **Rota Base**: `/dashboard/financeiro`

---

## 2. Rotas

| Rota | Guard | Página | Descrição |
|------|-------|--------|-----------|
| `/dashboard/financeiro` | Module | `Financeiro` | Hub financeiro |
| `/dashboard/financeiro/contas-a-pagar` | Screen(`financeiro_contas_pagar`) | `ContasAPagar` | Títulos AP |
| `/dashboard/financeiro/contas-a-pagar/:id` | Screen | `ContaPagarDetalhe` | Detalhe do título |
| `/dashboard/financeiro/contas-a-pagar/sync` | Screen | `ContasPagarSyncPage` | Sincronização ERP |
| `/dashboard/financeiro/contas-a-pagar/auditoria` | Screen | `ContasPagarAuditoria` | Auditoria AP |
| `/dashboard/financeiro/contas-a-receber` | Module | `ContasAReceber` | Títulos AR |
| `/dashboard/financeiro/contas-a-receber/auditoria` | Module | `ContasReceberAuditoria` | Auditoria AR |
| `/dashboard/financeiro/contas-a-receber/sync` | Module | `ContasReceberSyncPage` | Sincronização AR |
| `/dashboard/financeiro/cobranca` | Module | `CobrancaInadimplentes` | Cobrança inadimplentes |
| `/dashboard/financeiro/fluxo-de-caixa` | Module | `FluxoDeCaixa` | Fluxo de caixa |
| `/dashboard/financeiro/plano-contas` | Module | `PlanoContas` | Plano de contas |
| `/dashboard/financeiro/saldos-bancarios` | Module | `SaldosBancarios` | Saldos bancários |
| `/dashboard/financeiro/classificar-banco` | Module | `ClassificarTodoBanco` | Classificação IA banco |
| `/dashboard/financeiro/central-pagamentos` | Module | `FinancialPaymentCentral` | Central de pagamentos |
| `/dashboard/financeiro/consolidado` | Module | `FinanceiroConsolidadoDashboard` | Dashboard consolidado |
| `/dashboard/financeiro/conciliacao-bancaria` | Module | `ConciliacaoBancaria` | Conciliação Pluggy |
| `/dashboard/financeiro/investimentos` | Module | `InvestimentosCorporativos` | Investimentos |
| `/dashboard/financeiro/visao-departamentos` | Module | `VisaoDepartamentos` | Visão por departamento |
| `/dashboard/financeiro/dre-analitico` | Module | `DREAnalitico` | DRE analítico |

### Rotas Auxiliares (admin)

| Rota | Guard | Página |
|------|-------|--------|
| `/dashboard/fornecedores` | Screen(`financeiro_fornecedores`) | `Fornecedores` |
| `/dashboard/empresas` | Screen(`financeiro_empresas`) | `Empresas` |
| `/dashboard/centros-custo` | Screen(`financeiro_centros_custo`) | `CentrosCusto` |
| `/dashboard/bancos` | Screen(`financeiro_contas_bancarias`) | `ContasBancarias` |
| `/dashboard/pagamentos` | Screen(`financeiro_pagamentos`) | `Pagamentos` |
| `/dashboard/integracao-erp` | Screen(`admin`) | `IntegracaoERP` |

---

## 3. Contas a Pagar

### Tabelas

| Tabela | Colunas-Chave |
|--------|--------------|
| `contas_pagar` | id, titulo_numero, fornecedor_nome, fornecedor_codigo, valor_original, valor_aberto, status, data_emissao, data_vencimento, data_competencia, empresa_id, portador_id, plano_contas_id, centro_custo_id, numero_parcela, total_parcelas, importado_api, codigo_integracao, baixa_origem, data_baixa |
| `parcelas` | id, conta_pagar_id, numero_parcela, valor, data_vencimento, status, valor_pago |
| `pagamentos` | id, conta_pagar_id, parcela_id, valor_pago, data_pagamento, forma_pagamento, banco_id, observacao |

### Ciclo de Vida do Título

```
pendente
  │
  ├─► parcial (pagamento parcial registrado)
  │     │
  │     └─► pago (todas parcelas liquidadas)
  │
  ├─► pago (pagamento integral)
  │
  ├─► vencido (data_vencimento < now() AND valor_aberto > 0)
  │     │
  │     └─► pago (pagamento após vencimento)
  │
  └─► cancelado (fn_cancelar_titulo — irreversível, exige justificativa)
```

### RPCs Críticas

| Função | Parâmetros | Descrição |
|--------|-----------|-----------|
| `fn_criar_titulo_com_parcelas` | dados do título, num_parcelas | Cria título + parcelas automáticas com rateio e vencimentos mensais |
| `fn_registrar_pagamento` | conta_pagar_id, parcela_id, valor, data, forma | Registra pagamento, liquida parcela, atualiza saldo/status |
| `fn_cancelar_titulo` | conta_pagar_id, justificativa | Cancela título (irreversível) |

### Dashboard AP

- **Total a Pagar**: SUM(valor_aberto) WHERE status IN ('pendente', 'vencido', 'parcial')
- **Vencidos**: SUM(valor_aberto) WHERE status = 'vencido'
- **A Vencer**: SUM(valor_aberto) WHERE status = 'pendente' AND data_vencimento >= now()
- **Pagos no Mês**: SUM(valor_pago) WHERE data_pagamento no mês corrente

---

## 4. Contas a Receber

### Tabelas

| Tabela | Colunas-Chave |
|--------|--------------|
| `contas_receber` | id, titulo_numero, cliente_nome, cliente_codigo, valor_original, valor_aberto, status, data_emissao, data_vencimento, empresa_id |
| `parcelas_receber` | id, conta_receber_id, numero_parcela, valor, data_vencimento, status, valor_recebido |
| `recebimentos` | id, conta_receber_id, parcela_id, valor_recebido, data_recebimento, forma_recebimento |

### Trigger Automático

```sql
fn_sync_titulo_receber_status()
-- Atualiza status do título baseado nas parcelas:
-- Se todas parcelas = 'recebido' → título = 'recebido'
-- Se alguma parcela paga → título = 'parcial'
-- Se data_vencimento < now() AND valor_aberto > 0 → título = 'vencido'
-- Se cancelado → título = 'cancelado'
```

### RPCs

| Função | Descrição |
|--------|-----------|
| `fn_criar_titulo_receber` | Cria título + parcelas atômicamente |
| `fn_registrar_recebimento` | Registra recebimento com liquidação instantânea |

---

## 5. Plano de Contas DE-PARA

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `trade_chart_of_accounts` | Plano de contas interno (id, codigo, descricao, tipo, nivel, pai_id, erp_code) |
| `account_classification_rules` | Regras de classificação automática IA |
| `account_category_mapping` | Mapeamento conta → categoria DRE |
| `ai_training_examples` | Exemplos de treino para classificação IA |

### Classificação IA

```
Lançamento financeiro
  └─ IA analisa: histórico + fornecedor + valor + complemento
       ├─ Encontrou regra de confiança alta → aplica automaticamente
       └─ Confiança baixa → sugere para revisão humana
```

**Edge Functions**: `classificar-categoria-dre`, `classificar-contas-batch`, `classificar-contas-pagar-ia`, `classificar-conta-departamento`

---

## 6. DRE Analítico

Demonstrativo de Resultado do Exercício por:
- Empresa
- Centro de custo
- Departamento
- Período (mensal/trimestral/anual)

Estrutura hierárquica baseada no `trade_chart_of_accounts` (níveis pai → filho).

---

## 7. Fluxo de Caixa

Projeção de entradas e saídas:
- **Entradas**: contas_receber (por data_vencimento)
- **Saídas**: contas_pagar (por data_vencimento)
- **Saldo projetado**: saldo_atual + entradas - saídas (acumulado diário)

---

## 8. Saldos Bancários e Conciliação

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `bank_connections` | Conexões bancárias (Pluggy + manual) |
| `contas_bancarias` | Contas bancárias (agência, conta, banco, saldo_inicial, saldo_atual) |
| `bank_transactions` | Transações bancárias (Pluggy) |
| `balance_alerts` | Alertas de saldo mínimo |

### Integração Pluggy

```
Pluggy Widget → bank_connections (pluggy_item_id)
  └─ pluggy-webhook → atualiza saldos e transações
  └─ pluggy-proxy → consulta saldos em tempo real
  └─ conciliacao-bancaria → match transações × títulos AP/AR
```

**Campos de rastreio**: `baixa_origem` ('pluggy', 'erp_webhook', 'manual'), `pluggy_transaction_id`

---

## 9. Central de Pagamentos

### Tabela: `financial_payment_queue`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| conta_pagar_id | uuid | FK → contas_pagar |
| valor | numeric | Valor a pagar |
| data_programada | date | Data programada |
| status | text | pendente, aprovado, pago, rejeitado |
| aprovado_por | uuid | Quem aprovou |
| aprovado_em | timestamp | Data/hora aprovação |
| observacao | text | Observações |

### Governança

```
Título selecionado para pagamento
  └─ Adicionado à fila (status: pendente)
       └─ Aprovação (nível hierárquico)
            ├─ Aprovado → processamento
            │     └─ Baixa automática no título
            └─ Rejeitado → retorna à fila
```

---

## 10. Integração ERP Bidirecional

### Edge Functions de Integração

| Function | Direção | Descrição |
|----------|---------|-----------|
| `contas-pagar-api` | Inbound | n8n envia títulos AP para o CRM |
| `contas-pagar-export-api` | Outbound | ERP busca títulos (inclui `/cancelled`) |
| `contas-receber-api` | Inbound | n8n envia títulos AR |
| `n8n-contas-receber` | Inbound | Sync de recebíveis |
| `erp-webhook-inbound` | Inbound | Webhook genérico do ERP |
| `erp-export-payment` | Outbound | Exporta pagamentos para ERP |
| `erp-fornecedores-query` | Query | Consulta fornecedores no ERP |
| `erp-portadores-api` | Inbound | Sync de portadores (bancos) |
| `erp-plano-contas-api` | Inbound | Sync de plano de contas |

### Autenticação Multi-Padrão

1. **Variáveis de ambiente**: `N8N_API_KEY`, `EXPORT_API_KEY` (legado)
2. **Lookup `erp_config`**: Configuração multi-tenant
3. **`erp_api_keys`**: Portal de Integração ERP (gerenciado)

### Tabela de Sync

```sql
erp_sync_log (
  id, tabela_origem, registro_id, direcao, -- 'inbound'/'outbound'
  status,        -- pendente, enviando, enviado, erro, ignorado
  idempotency_key, -- janela 7 dias (inbound)
  proximo_envio,
  tentativas, max_tentativas, -- padrão 3
  erro_detalhe
)
```

---

## 11. Cobrança de Inadimplentes

**Rota**: `/dashboard/financeiro/cobranca`

Funcionalidades:
- Lista de títulos vencidos por cliente
- Envio de cobrança via WhatsApp (automação)
- Histórico de cobranças enviadas
- Aging report (0-30, 31-60, 61-90, 90+ dias)

**Edge Functions**: `cobranca-automation-api`, `cobranca-whatsapp-webhook`

---

## Referências

- [Mapa de Módulos](./MODULES_OVERVIEW.md)
- [Trade + Comercial](./MODULE_TRADE_COMERCIAL.md)
- [Infraestrutura](./INFRASTRUCTURE.md)
