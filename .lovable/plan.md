

## Plano: Expansão Completa da Integração Pluggy (sem Pagamentos)

### Escopo Total

11 funcionalidades da API Pluggy + 5 automações combinadas. Organizadas em 4 fases por dependência técnica.

---

### FASE 1 — Infraestrutura Base (Edge Function + Tabelas)

**1.1. Expandir Edge Function `conciliacao-bancaria`** com novos actions:

| Action | Endpoint Pluggy | Descrição |
|--------|----------------|-----------|
| `list-connectors` | `GET /connectors` | Listar bancos/instituições disponíveis |
| `fetch-identity` | `GET /identity?itemId=X` | Dados do titular (CPF/CNPJ, nome, endereço) |
| `fetch-investments` | `GET /investments?itemId=X` | Investimentos do item |
| `fetch-investment-detail` | `GET /investments/{id}` | Detalhe de um investimento |
| `fetch-investment-transactions` | `GET /investments/{id}/transactions` | Movimentações (aplicações, resgates) |
| `fetch-accounts` | `GET /items/{id}/accounts` | Incluir contas CREDIT_CARD e LOAN |
| `fetch-categories` | `GET /categories` | Árvore de categorias da Pluggy |
| `create-category-rule` | `POST /categories/rules` | Criar regra customizada |
| `list-category-rules` | `GET /categories/rules` | Listar regras existentes |

**1.2. Migration — Novas tabelas**

```sql
-- Investimentos corporativos
CREATE TABLE public.pluggy_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID REFERENCES bank_connections(id) ON DELETE CASCADE,
  pluggy_investment_id TEXT UNIQUE NOT NULL,
  name TEXT,
  type TEXT,           -- SECURITY, MUTUAL_FUND, EQUITY, etc.
  subtype TEXT,        -- RETIREMENT, CDB, LCI, etc.
  balance NUMERIC(15,2) DEFAULT 0,
  currency_code TEXT DEFAULT 'BRL',
  annual_rate NUMERIC(8,4),
  status TEXT,         -- ACTIVE, REDEEMED
  due_date DATE,
  issuer TEXT,
  issue_date DATE,
  metadata JSONB DEFAULT '{}',
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Transações de investimento
CREATE TABLE public.pluggy_investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID REFERENCES pluggy_investments(id) ON DELETE CASCADE,
  pluggy_transaction_id TEXT UNIQUE NOT NULL,
  type TEXT,           -- BUY, SELL, DIVIDEND, TAX, etc.
  description TEXT,
  amount NUMERIC(15,2),
  quantity NUMERIC(15,6),
  value NUMERIC(15,2),
  date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Identidade do titular
CREATE TABLE public.pluggy_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID REFERENCES bank_connections(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT,
  document TEXT,        -- CPF ou CNPJ
  document_type TEXT,
  tax_number TEXT,      -- CNPJ
  birth_date DATE,
  addresses JSONB DEFAULT '[]',
  emails JSONB DEFAULT '[]',
  phones JSONB DEFAULT '[]',
  raw_data JSONB DEFAULT '{}',
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cartões de crédito (extensão de bank_connections)
ALTER TABLE bank_connections
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'BANK',
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS available_limit NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS bill_due_date DATE,
  ADD COLUMN IF NOT EXISTS bill_amount NUMERIC(15,2);

-- Empréstimos
CREATE TABLE public.pluggy_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID REFERENCES bank_connections(id) ON DELETE CASCADE,
  pluggy_account_id TEXT,
  name TEXT,
  loan_amount NUMERIC(15,2),
  outstanding_balance NUMERIC(15,2),
  interest_rate NUMERIC(8,4),
  installments_total INT,
  installments_paid INT,
  next_payment_date DATE,
  monthly_payment NUMERIC(15,2),
  contract_number TEXT,
  metadata JSONB DEFAULT '{}',
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Regras de categorização customizadas
CREATE TABLE public.pluggy_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pluggy_rule_id TEXT,
  description TEXT NOT NULL,
  category_id TEXT NOT NULL,
  category_name TEXT,
  conta_contabil_id UUID REFERENCES trade_chart_of_accounts(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alertas de saldo
CREATE TABLE public.balance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID REFERENCES bank_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  threshold NUMERIC(15,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar categoria Pluggy às conciliacoes_bancarias
ALTER TABLE conciliacoes_bancarias
  ADD COLUMN IF NOT EXISTS pluggy_category TEXT,
  ADD COLUMN IF NOT EXISTS pluggy_category_id TEXT,
  ADD COLUMN IF NOT EXISTS conta_contabil_id UUID REFERENCES trade_chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS payment_data JSONB;
```

RLS: Todas as tabelas com policies baseadas em `user_id` via `bank_connections` join (padrão existente).

---

### FASE 2 — Webhook Avançado (Sync Automática)

**2.1. Expandir `pluggy-webhook`** para tratar novos eventos:

- `item/updated` → Já existe. Adicionar: sincronizar transações automaticamente (chamar a mesma lógica de `handleSyncTransactions`)
- `transactions/created` → Novo. Sincronização incremental apenas das novas transações
- `connector/status_updated` → Novo. Atualizar status do conector no `bank_connections`

**2.2. Registrar webhooks na Pluggy** via `POST /webhooks`:
- Adicionar action `register-webhook` na edge function para registrar URL do webhook automaticamente ao criar conexão

---

### FASE 3 — Dashboards e UI

**3.1. Dashboard de Investimentos** — Nova página `InvestimentosCorporativos.tsx`
- Cards: Patrimônio Total, Rendimento Mensal, Composição por Tipo
- Tabela com investimentos por filial (nome, tipo, saldo, taxa, vencimento)
- Gráfico de composição da carteira (recharts PieChart)
- Histórico de movimentações (aplicações, resgates, dividendos)
- Botão "Sincronizar Investimentos" por conexão

**3.2. Painel de Cartões de Crédito** — Novo componente na Conciliação
- Cards de limite disponível/utilizado por cartão
- Faturas pendentes e conciliação com despesas corporativas
- Transações de cartão categorizadas

**3.3. Monitor de Empréstimos** — Novo componente
- Tabela com empréstimos ativos (saldo devedor, parcelas, juros)
- Próximos pagamentos e timeline

**3.4. Validação de Fornecedores** — Integrar ao cadastro existente
- Ao conectar banco, buscar identidade e salvar CPF/CNPJ
- Na tela de fornecedores, botão "Validar via banco" que cruza CPF/CNPJ do fornecedor com dados da identidade bancária

**3.5. Gestão de Categorias** — Novo componente na Conciliação
- Listar categorias Pluggy com mapeamento para plano de contas
- Criar regras customizadas (ex: "Mc Donalds" → Alimentação → 3.3.xx)
- Tabela de regras ativas com opção de excluir

**3.6. Alertas de Saldo** — Configuração por conta
- Input de threshold no PainelSaldos
- Badge de alerta quando saldo < threshold

---

### FASE 4 — Automações Inteligentes

**4.1. DRE Automático por Categorização**
- Ao sincronizar transações, mapear `pluggy_category` → `conta_contabil_id` via tabela de regras
- Alimentar DRE automaticamente usando as categorias

**4.2. Fluxo de Caixa Projetado**
- Cruzar transações recorrentes categorizadas + contas a pagar futuras
- Componente de projeção no dashboard financeiro consolidado

**4.3. Conciliação 100% Automática via Webhook**
- Webhook `transactions/created` dispara matching automático
- Alta confiança → concilia e baixa automaticamente
- Média/Baixa → deixa pendente para revisão manual

**4.4. Alertas de Saldo Baixo**
- No webhook `item/updated`, após atualizar saldo, verificar thresholds
- Se saldo < threshold, inserir notificação via tabela existente

---

### Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| Migration SQL (1 arquivo) | Criar 6 tabelas + alterar 2 |
| `supabase/functions/conciliacao-bancaria/index.ts` | +9 actions |
| `supabase/functions/pluggy-webhook/index.ts` | +2 event handlers + auto-sync |
| `src/hooks/useConciliacaoBancaria.ts` | +6 queries/mutations |
| `src/hooks/usePluggyInvestments.ts` | Novo hook |
| `src/hooks/usePluggyIdentity.ts` | Novo hook |
| `src/hooks/useBalanceAlerts.ts` | Novo hook |
| `src/pages/financeiro/InvestimentosCorporativos.tsx` | Nova página |
| `src/components/conciliacao/PainelCartoes.tsx` | Novo componente |
| `src/components/conciliacao/MonitorEmprestimos.tsx` | Novo componente |
| `src/components/conciliacao/GestaoCategoriasPluggy.tsx` | Novo componente |
| `src/components/conciliacao/AlertasSaldo.tsx` | Novo componente |
| `src/components/conciliacao/PainelSaldos.tsx` | Adicionar alertas |
| `src/components/conciliacao/DashboardConciliacao.tsx` | Expandir métricas |
| `src/pages/financeiro/ConciliacaoBancaria.tsx` | +3 tabs |
| `src/App.tsx` | +1 rota |
| `src/components/dashboard/AppSidebar.tsx` | Link investimentos |

### Implementação

Dado o volume, implementarei fase a fase em sequência: infraestrutura primeiro (tabelas + edge function), depois webhook, depois UI, depois automações.

