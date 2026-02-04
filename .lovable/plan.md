
# Plano: Central de Pagamentos do Financeiro para Trade e Eventos

## Contexto e Problema

Atualmente, quando uma campanha de Trade, lançamento financeiro, investimento ou despesa de evento é aprovado pelos supervisores, **não há um fluxo seguro e padronizado para que o Financeiro receba e processe esses pagamentos**.

O módulo de Eventos já tem uma implementação parcial (`send_to_financial`, status `pending_financial`), mas:
- Trade Marketing não tem esse fluxo
- O Financeiro não tem uma tela centralizada para visualizar todos os itens pendentes
- Não há rastreabilidade do aceite/recusa pelo financeiro

---

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE APROVAÇÃO PARA PAGAMENTO                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐  │
│   │  TRADE MARKETING│     │  EVENTOS CORP.  │     │   OUTRAS ORIGENS    │  │
│   │   - Campanhas   │     │   - Despesas    │     │   (futuro)          │  │
│   │   - Lançamentos │     │                 │     │                     │  │
│   │   - Investimentos│    │                 │     │                     │  │
│   └────────┬────────┘     └────────┬────────┘     └──────────┬──────────┘  │
│            │                       │                         │              │
│            ▼                       ▼                         ▼              │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │              APROVAÇÃO SUPERVISOR/GERENTE (já existe)               │  │
│   │         status = "approved" / approval_status = "approved"          │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                     ┌──────────────┴──────────────┐                        │
│                     ▼                              ▼                        │
│            ┌────────────────┐           ┌────────────────────┐             │
│            │ SEM PAGAMENTO  │           │ ENVIAR AO FINANCEIRO│             │
│            │ (apenas verba) │           │ send_to_financial=true│           │
│            └────────────────┘           └──────────┬─────────┘             │
│                                                     │                        │
│                                                     ▼                        │
│                              ┌──────────────────────────────────────────┐  │
│                              │     FILA DE PAGAMENTOS DO FINANCEIRO     │  │
│                              │     (financial_payment_queue - NOVA)     │  │
│                              │                                          │  │
│                              │  • ID único de rastreamento              │  │
│                              │  • Origem (trade/evento)                 │  │
│                              │  • Dados do fornecedor                   │  │
│                              │  • Dados do documento                    │  │
│                              │  • Vencimento                            │  │
│                              │  • Valor                                 │  │
│                              │  • Status financeiro                     │  │
│                              └────────────────────┬─────────────────────┘  │
│                                                   │                         │
│                    ┌──────────────────────────────┼───────────────────┐    │
│                    ▼                              ▼                   ▼    │
│           ┌────────────────┐           ┌────────────────┐    ┌───────────┐│
│           │ ACEITO         │           │ REJEITADO      │    │ PAGO      ││
│           │ financial_     │           │ Volta para     │    │ Vincula   ││
│           │ status=accepted│           │ solicitante    │    │ contas_   ││
│           └────────────────┘           └────────────────┘    │ pagar     ││
│                                                              └───────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Nova Tabela: `financial_payment_queue`

Centraliza todos os itens de pagamento vindos de diferentes módulos.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | Identificador único |
| `code` | varchar | Código legível (FPQ-2025-001) |
| `source_type` | varchar | Origem: 'trade_entry', 'trade_investment', 'trade_campaign', 'event_expense' |
| `source_id` | uuid | ID do registro de origem |
| `source_code` | varchar | Código da origem (p/ referência rápida) |
| `supplier_name` | varchar | Nome do fornecedor/beneficiário |
| `supplier_document` | varchar | CNPJ/CPF |
| `document_type` | varchar | Tipo: NF, Boleto, Recibo, etc. |
| `document_number` | varchar | Número do documento |
| `amount` | numeric | Valor a pagar |
| `due_date` | date | Data de vencimento |
| `portador` | varchar | Forma de pagamento |
| `description` | text | Descrição do pagamento |
| `notes` | text | Observações |
| `attachment_url` | text | URL do comprovante/documento |
| `department_name` | varchar | Departamento solicitante |
| `requested_by` | uuid | Usuário que solicitou |
| `requested_at` | timestamptz | Data da solicitação |
| `financial_status` | varchar | 'pending', 'accepted', 'rejected', 'paid', 'cancelled' |
| `financial_notes` | text | Justificativa do financeiro |
| `reviewed_by` | uuid | Usuário do financeiro que revisou |
| `reviewed_at` | timestamptz | Data da revisão |
| `paid_at` | timestamptz | Data do pagamento |
| `contas_pagar_id` | uuid | FK para contas_pagar (quando criado) |
| `created_at` | timestamptz | Data de criação |
| `updated_at` | timestamptz | Última atualização |

---

## 2. Modificações em Tabelas Existentes

### 2.1 `trade_financial_entries`
Adicionar campos para direcionar ao financeiro:
- `send_to_financial` (boolean)
- `supplier_name` (varchar)
- `supplier_document` (varchar)
- `document_type` (varchar)
- `document_number` (varchar)
- `due_date` (date)
- `portador` (varchar)
- `payment_queue_id` (uuid, FK para financial_payment_queue)

### 2.2 `trade_investments`
Adicionar os mesmos campos acima.

---

## 3. Nova Página: Central de Pagamentos do Financeiro

**Rota:** `/dashboard/financeiro/central-pagamentos`

### Layout:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  💳 Central de Pagamentos                    [Filtro Data] [🔄 Atualizar]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Pendentes│  │ Aceitos  │  │ Rejeitados│  │   Pagos  │  │  Total   │      │
│  │    12    │  │    8     │  │     2     │  │    45    │  │R$ 125.000│      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Trade] [Eventos] [Todos]           [Filtrar por Status ▼] [Buscar...]     │
├─────────────────────────────────────────────────────────────────────────────┤
│  📋 Itens Pendentes de Aprovação Financeira                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Código    │ Origem     │ Fornecedor      │ Valor     │ Venc.   │ Ações  ││
│  ├───────────┼────────────┼─────────────────┼───────────┼─────────┼────────┤│
│  │ FPQ-001   │ 🎯 Trade   │ ABC Materiais   │ R$ 5.000  │ 10/02   │[Revisar]│
│  │ FPQ-002   │ 📅 Evento  │ Hotel XYZ       │ R$ 12.000 │ 12/02   │[Revisar]│
│  │ FPQ-003   │ 🎯 Trade   │ Gráfica 123     │ R$ 800    │ 15/02   │[Revisar]│
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Dialog de Revisão Financeira

Ao clicar em "Revisar", o financeiro visualiza:

1. **Dados do Solicitante** - Quem pediu, quando, de qual módulo
2. **Detalhes do Pagamento** - Fornecedor, documento, valor, vencimento
3. **Histórico de Aprovações** - Quem aprovou no Trade/Eventos
4. **Documentos Anexos** - Notas fiscais, comprovantes
5. **Ações:**
   - ✅ **Aceitar** - Marca como aceito, cria registro em `contas_pagar`
   - ❌ **Rejeitar** - Requer justificativa, notifica solicitante
   - 💰 **Marcar como Pago** - Após pagamento efetivo

---

## 5. Novos Componentes

| Componente | Descrição |
|------------|-----------|
| `FinancialPaymentCentral.tsx` | Página principal da central |
| `PaymentQueueKPIs.tsx` | Cards de métricas |
| `PaymentQueueTable.tsx` | Tabela de itens |
| `PaymentReviewDialog.tsx` | Dialog de revisão/aprovação |
| `EnviarFinanceiroTradeDialog.tsx` | Dialog para Trade enviar ao financeiro |

---

## 6. Hooks e Queries

| Hook | Descrição |
|------|-----------|
| `useFinancialPaymentQueue.ts` | CRUD da fila de pagamentos |
| `usePendingPayments.ts` | Items pendentes de revisão financeira |

---

## 7. Fluxo do Usuário

### Trade Marketing:
1. Vendedor cria lançamento/investimento
2. Supervisor aprova
3. Na aprovação, aparece checkbox **"Direcionar ao Financeiro para Pagamento"**
4. Se marcado, abre dialog para preencher dados do fornecedor
5. Item entra na fila do financeiro

### Eventos Corporativos:
1. Fluxo já existente com `send_to_financial`
2. Ajustar para usar a nova tabela `financial_payment_queue`

### Financeiro:
1. Acessa Central de Pagamentos
2. Visualiza todos os itens pendentes de Trade e Eventos
3. Revisa, aceita ou rejeita
4. Ao aceitar, pode vincular/criar registro em `contas_pagar`

---

## 8. Segurança e RLS

### Políticas:
- **Leitura:** Apenas usuários do departamento Financeiro/Tesouraria
- **Inserção:** Usuários autenticados com permissão em Trade ou Eventos
- **Atualização:** Apenas usuários do Financeiro podem alterar `financial_status`
- **Auditoria:** Todos os campos de revisão são obrigatórios

### Função RLS:
```sql
CREATE OR REPLACE FUNCTION can_access_payment_queue(_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    JOIN departamentos d ON p.departamento_id = d.id
    WHERE p.id = _user_id 
    AND d.nome IN ('Financeiro', 'Tesouraria', 'Controladoria')
  )
  OR public.has_role(_user_id, 'admin')
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

## 9. Navegação

- Adicionar link na sidebar do Financeiro: **"Central de Pagamentos"**
- Badge com contador de itens pendentes
- Notificação quando novos itens chegarem

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/FinancialPaymentCentral.tsx` | Página principal |
| `src/components/financeiro/payments/PaymentQueueKPIs.tsx` | KPIs |
| `src/components/financeiro/payments/PaymentQueueTable.tsx` | Tabela |
| `src/components/financeiro/payments/PaymentReviewDialog.tsx` | Dialog revisão |
| `src/components/trade/EnviarFinanceiroTradeDialog.tsx` | Dialog Trade→Financeiro |
| `src/hooks/useFinancialPaymentQueue.ts` | Hook principal |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/trade/AprovarLancamentoDialog.tsx` | Adicionar opção de enviar ao financeiro |
| `src/components/dashboard/AppSidebar.tsx` | Adicionar link Central de Pagamentos |
| `src/App.tsx` | Nova rota |
| `src/hooks/useEventExpenses.ts` | Integrar com nova tabela |

## Migrações de Banco

1. Criar tabela `financial_payment_queue`
2. Adicionar colunas em `trade_financial_entries`
3. Adicionar colunas em `trade_investments`
4. Criar políticas RLS
5. Criar função `can_access_payment_queue`

---

## Benefícios

1. **Centralização** - Todos os pagamentos em um único lugar
2. **Rastreabilidade** - Histórico completo de quem solicitou, aprovou, pagou
3. **Segurança** - RLS garante que apenas o financeiro pode aprovar pagamentos
4. **Auditoria** - Campos obrigatórios de justificativa e timestamp
5. **Flexibilidade** - Fácil adicionar novas origens de pagamento no futuro
