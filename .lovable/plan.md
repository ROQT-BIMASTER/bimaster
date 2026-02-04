
# Plano: Sistema de Despesas de Eventos com Integração Financeira

## Resumo Executivo

Criar um módulo de **Eventos Corporativos** que:
1. Compartilha verbas (`trade_budgets`) com Trade Marketing
2. Permite que lançamentos sejam enviados ao Financeiro para pagamento
3. Centraliza aprovações em um único painel para Trade + Eventos
4. Requer preenchimento de dados do documento e fornecedor quando enviado ao financeiro

---

## Arquitetura Proposta

### Fluxo Completo

```text
USUÁRIO CRIA EVENTO
       ↓
VINCULA A UMA VERBA (trade_budgets - compartilhada)
       ↓
LANÇA DESPESAS DO EVENTO
       ↓
┌─────────────────────────────────────────────┐
│ OPÇÃO 1: Apenas Aprovar Internamente        │
│   → Status: approved                        │
│   → Verba consumida                         │
│   → Não vai para Contas a Pagar             │
└─────────────────────────────────────────────┘
       OU
┌─────────────────────────────────────────────┐
│ OPÇÃO 2: Enviar ao Financeiro para Pagar    │
│   → Preencher: Fornecedor, Tipo Doc,        │
│     Nº Doc, Data Vencimento, Portador       │
│   → Status: pending_financial               │
│   → Cai no painel de Aprovações Financeiro  │
└─────────────────────────────────────────────┘
       ↓
FINANCEIRO APROVA E PAGA
       ↓
Registro criado em contas_pagar ou atualizado
```

---

## Mudanças no Banco de Dados

### Nova Tabela: `corporate_events`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| code | varchar | Código (EV-2025-001) |
| name | varchar | Nome do evento |
| description | text | Descrição |
| event_type | varchar | conferencia, workshop, feira, interno, externo |
| event_date | date | Data do evento |
| end_date | date | Data término (opcional) |
| location | varchar | Local |
| budget_id | uuid | FK → trade_budgets (verba compartilhada) |
| budget_amount | numeric | Orçamento alocado para este evento |
| actual_cost | numeric | Custo realizado |
| status | varchar | draft, pending_approval, approved, in_progress, completed, cancelled |
| confidential | boolean | Se é reservado/confidencial |
| responsible_user_id | uuid | Responsável |
| created_by | uuid | Criador |
| approved_by | uuid | Aprovador |
| approved_at | timestamp | Data aprovação |
| created_at | timestamp | |
| updated_at | timestamp | |

### Nova Tabela: `corporate_event_expenses`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| event_id | uuid | FK → corporate_events |
| category | varchar | alimentacao, transporte, hospedagem, material, servicos, brindes, locacao, marketing, outros |
| description | text | Descrição da despesa |
| valor_previsto | numeric | Valor orçado |
| valor_realizado | numeric | Valor efetivo |
| expense_date | date | Data da despesa |
| status | varchar | pending, approved, rejected, pending_financial, paid |
| comprovante_url | text | URL comprovante |
| evidencias | jsonb | Arquivos anexados |
| --- Campos para Envio ao Financeiro --- | | |
| send_to_financial | boolean | Se deve ir para financeiro pagar |
| supplier_name | varchar | Nome do fornecedor |
| supplier_document | varchar | CNPJ/CPF fornecedor |
| document_type | varchar | NF, Boleto, Recibo, Fatura, etc |
| document_number | varchar | Número do documento |
| due_date | date | Data de vencimento |
| portador | varchar | Forma de pagamento (BRADESCO, ITAU, CARTEIRA, etc) |
| payment_notes | text | Observações para pagamento |
| financial_approved_by | uuid | Aprovador do financeiro |
| financial_approved_at | timestamp | Data aprovação financeiro |
| contas_pagar_id | uuid | FK opcional → contas_pagar (quando integrado) |
| created_by | uuid | |
| approved_by | uuid | |
| approved_at | timestamp | |
| created_at | timestamp | |
| updated_at | timestamp | |

### Nova Tabela: `corporate_event_access`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| can_create_events | boolean | Pode criar eventos |
| can_approve_events | boolean | Pode aprovar eventos |
| can_view_confidential | boolean | Pode ver eventos confidenciais |
| can_manage_expenses | boolean | Pode gerenciar despesas |
| created_by | uuid | Quem concedeu |
| created_at | timestamp | |

---

## Novos Componentes e Páginas

### Páginas

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `CorporateEvents.tsx` | /dashboard/eventos | Lista de eventos |
| `CorporateEventDetail.tsx` | /dashboard/eventos/:id | Detalhes + despesas |
| `CorporateEventsDashboard.tsx` | /dashboard/eventos/dashboard | Dashboard financeiro |
| `FinancialApprovalHub.tsx` | /dashboard/financeiro/aprovacoes | Central unificada Trade + Eventos |

### Componentes

| Arquivo | Descrição |
|---------|-----------|
| `NovoEventoDialog.tsx` | Modal criar evento |
| `NovaDespesaEventoDialog.tsx` | Modal lançar despesa |
| `EnviarFinanceiroDialog.tsx` | Modal com campos de documento/fornecedor |
| `AprovarDespesaFinanceiroDialog.tsx` | Modal aprovação pelo financeiro |
| `EventsKPICards.tsx` | Cards métricas eventos |
| `EventsExpensesTable.tsx` | Tabela despesas |
| `FinancialPendingTable.tsx` | Tabela itens pendentes financeiro |

### Hooks

| Arquivo | Descrição |
|---------|-----------|
| `useCorporateEvents.ts` | CRUD eventos |
| `useEventExpenses.ts` | CRUD despesas eventos |
| `useFinancialPendingItems.ts` | Itens pendentes pagamento (Trade + Eventos) |

---

## Fluxo de Envio ao Financeiro

### Quando o usuário clica "Enviar ao Financeiro"

1. Abre modal `EnviarFinanceiroDialog` com campos:

```text
┌─────────────────────────────────────────────────────────┐
│  ENVIAR PARA PAGAMENTO                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Dados do Fornecedor:                                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Nome do Fornecedor *                            │    │
│  │ [____________________________________]          │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ CNPJ/CPF                                        │    │
│  │ [____________________________________]          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Dados do Documento:                                    │
│  ┌────────────────────┐  ┌─────────────────────────┐   │
│  │ Tipo Documento *   │  │ Número Documento *      │   │
│  │ [NF           ▼]   │  │ [________________]      │   │
│  └────────────────────┘  └─────────────────────────┘   │
│                                                         │
│  ┌────────────────────┐  ┌─────────────────────────┐   │
│  │ Data Vencimento *  │  │ Portador/Forma Pgto *   │   │
│  │ [__/__/____]       │  │ [BRADESCO       ▼]      │   │
│  └────────────────────┘  └─────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Observações para Pagamento                      │    │
│  │ [____________________________________]          │    │
│  │ [____________________________________]          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  [Cancelar]                    [Enviar ao Financeiro]   │
└─────────────────────────────────────────────────────────┘
```

2. Ao confirmar:
   - `status` → `pending_financial`
   - `send_to_financial` → `true`
   - Campos de documento preenchidos

3. Item aparece na Central de Aprovações do Financeiro

---

## Central de Aprovações Financeiro (Unificada)

### Localização: `/dashboard/financeiro/aprovacoes`

O painel existente será expandido para incluir 3 abas:

1. **Trade Marketing** - Campanhas e lançamentos de trade
2. **Eventos Corporativos** - Despesas de eventos enviadas ao financeiro
3. **Verbas** - Solicitações de novas verbas (já existe)

### Estrutura da Aba "Eventos Corporativos"

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Pendentes de Pagamento - Eventos                                   │
├──────────┬──────────────┬──────────────┬────────────┬──────────────┤
│ Evento   │ Fornecedor   │ Documento    │ Vencimento │ Valor        │ Ações
├──────────┼──────────────┼──────────────┼────────────┼──────────────┤
│ EV-001   │ Buffet XYZ   │ NF 12345     │ 15/02/2026 │ R$ 5.000,00  │ [Revisar]
│ EV-003   │ Hotel ABC    │ FATURA 789   │ 20/02/2026 │ R$ 12.500,00 │ [Revisar]
└──────────┴──────────────┴──────────────┴────────────┴──────────────┘
```

### Ao Revisar

O financeiro pode:
1. **Aprovar e Marcar como Pago** - Define data de pagamento real
2. **Rejeitar** - Devolve para o solicitante com motivo
3. **Solicitar Correção** - Pede ajustes nos dados do documento

---

## Políticas de Segurança (RLS)

### corporate_events

- **SELECT**: Admin/Supervisor OU responsável OU criador OU tem acesso via `corporate_event_access`
- Eventos `confidential = true`: apenas usuários com `can_view_confidential = true`
- **INSERT**: Usuários com `can_create_events = true`
- **UPDATE/DELETE**: Criador, responsável ou admin

### corporate_event_expenses

- **SELECT**: Herda do evento pai
- **INSERT/UPDATE**: Criador ou usuário com `can_manage_expenses = true`
- Status `pending_financial`: Visível também por usuários do módulo financeiro

---

## Integração com Verbas Existentes

Os eventos utilizarão a mesma tabela `trade_budgets`:

- Campo `budget_id` na tabela `corporate_events` referencia `trade_budgets`
- Ao aprovar despesa de evento, o `spent_amount` da verba é atualizado
- Dashboard de verbas mostrará consumo consolidado (Trade + Eventos)

---

## Arquivos a Criar/Modificar

### Novos Arquivos

1. `src/pages/CorporateEvents.tsx`
2. `src/pages/CorporateEventDetail.tsx`
3. `src/pages/CorporateEventsDashboard.tsx`
4. `src/components/events/NovoEventoDialog.tsx`
5. `src/components/events/NovaDespesaEventoDialog.tsx`
6. `src/components/events/EnviarFinanceiroDialog.tsx`
7. `src/components/events/EventsKPICards.tsx`
8. `src/components/events/EventsExpensesTable.tsx`
9. `src/hooks/useCorporateEvents.ts`
10. `src/hooks/useEventExpenses.ts`
11. `src/hooks/useFinancialPendingItems.ts`

### Arquivos a Modificar

1. `src/pages/TradeAprovacoes.tsx` - Adicionar aba "Eventos"
2. `src/App.tsx` - Adicionar rotas de eventos
3. `src/components/dashboard/DashboardSidebar.tsx` - Adicionar menu "Eventos"

---

## Categorias de Despesas de Eventos

| Código | Label |
|--------|-------|
| alimentacao | Alimentação e Bebidas |
| transporte | Transporte e Logística |
| hospedagem | Hospedagem |
| material | Materiais e Impressos |
| servicos | Serviços Terceirizados |
| brindes | Brindes e Premiações |
| locacao | Locação de Espaço/Equipamentos |
| marketing | Divulgação e Marketing |
| outros | Outros |

---

## Tipos de Documento para Pagamento

| Valor | Label |
|-------|-------|
| nf | Nota Fiscal |
| nfse | NFS-e (Serviços) |
| boleto | Boleto Bancário |
| recibo | Recibo |
| fatura | Fatura |
| duplicata | Duplicata |
| outros | Outros |

---

## Portadores/Formas de Pagamento

Obtidos dinamicamente da tabela `contas_pagar`:
- BRADESCO
- ITAU
- CARTEIRA
- DEPOSITO EM CONTA
- PIX
- etc.

---

## Resumo de Entregáveis

1. **Migração SQL**: 3 tabelas novas + RLS + índices + foreign keys
2. **Páginas**: 3 novas páginas
3. **Componentes**: 8 novos componentes
4. **Hooks**: 3 novos hooks
5. **Rotas**: 4 novas rotas
6. **Modificações**: 3 arquivos existentes

O sistema replica a experiência do Trade Marketing mas com recursos adicionais para:
- Controle de acesso a eventos confidenciais
- Preenchimento obrigatório de dados de pagamento
- Integração com o fluxo de Contas a Pagar do financeiro
