
# Plano: Sistema de Gestao de Despesas por Departamento

## Contexto

O usuario deseja replicar a estrutura do modulo de Eventos Corporativos para **todos os departamentos da empresa**. Cada departamento tera:
- Seu proprio modulo de gestao de despesas
- Um gerente responsavel com poder de aprovacao
- Funcionarios que podem criar despesas e envia-las ao financeiro
- Verba propria com controle financeiro dedicado
- Dashboard financeiro especifico

A tabela `departamentos` ja existe no banco com departamentos como: RH, Financeiro, Comercial, Marketing, Operacoes, TI, Administrativo, Logistica, Trade Marketing.

---

## Arquitetura da Solucao

```text
+------------------------------------------------------------------+
|                    SISTEMA DE DEPARTAMENTOS                       |
+------------------------------------------------------------------+
|                                                                  |
|  DEPARTAMENTO (ex: Marketing, RH, TI)                            |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  VERBAS DO DEPARTAMENTO                                    |  |
|  |  +-------------------------------------------------------+ |  |
|  |  | - Verba anual alocada                                 | |  |
|  |  | - Verba utilizada                                     | |  |
|  |  | - Verba disponivel                                    | |  |
|  |  | - Solicitacao de verba adicional                      | |  |
|  |  +-------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  SOLICITACOES DE DESPESAS                                  |  |
|  |  +-------------------------------------------------------+ |  |
|  |  | - Categoria (viagem, material, servicos, etc)         | |  |
|  |  | - Valor previsto / realizado                          | |  |
|  |  | - Status: rascunho -> pendente -> aprovado -> pago    | |  |
|  |  | - Anexos (notas fiscais, comprovantes)                | |  |
|  |  | - Envio ao financeiro                                 | |  |
|  |  +-------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  FLUXO DE APROVACAO                                        |  |
|  |  +-------------------------------------------------------+ |  |
|  |  | Funcionario -> Gerente Dept -> Financeiro -> Pago     | |  |
|  |  +-------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

---

## Estrutura de Banco de Dados

### 1. Nova Tabela: `department_budgets` (Verbas por Departamento)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| department_id | uuid | FK para departamentos |
| code | varchar | Codigo auto-gerado (VDEP-001) |
| name | varchar | Nome da verba |
| total_amount | numeric | Valor total alocado |
| spent_amount | numeric | Valor utilizado |
| available_amount | numeric | Valor disponivel (computed) |
| period_start | date | Inicio do periodo |
| period_end | date | Fim do periodo |
| status | varchar | active, pending, approved, closed |
| approval_status | text | pending, approved, rejected |
| created_by | uuid | Usuario que criou |
| approved_by | uuid | Usuario que aprovou |
| approved_at | timestamptz | Data de aprovacao |
| notes | text | Observacoes |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2. Nova Tabela: `department_expenses` (Despesas por Departamento)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| department_id | uuid | FK para departamentos |
| budget_id | uuid | FK para department_budgets |
| code | varchar | Codigo auto-gerado (DDEP-001) |
| category | varchar | Categoria da despesa |
| description | text | Descricao |
| valor_previsto | numeric | Valor estimado |
| valor_realizado | numeric | Valor efetivo |
| expense_date | date | Data da despesa |
| status | varchar | pending, approved, rejected, pending_financial, paid |
| supplier_name | varchar | Nome do fornecedor |
| supplier_document | varchar | CNPJ/CPF |
| document_type | varchar | NF, Boleto, Recibo |
| document_number | varchar | Numero do documento |
| due_date | date | Data de vencimento |
| portador | varchar | Portador para pagamento |
| attachments | jsonb | Array de anexos |
| payment_notes | text | Notas para pagamento |
| send_to_financial | boolean | Enviado ao financeiro |
| created_by | uuid | Criador |
| approved_by | uuid | Aprovador (gerente) |
| approved_at | timestamptz | |
| financial_approved_by | uuid | |
| financial_approved_at | timestamptz | |
| paid_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 3. Atualizar Tabela: `departamentos`

Adicionar coluna `responsavel_id` (ja existe, mas precisa ser populada) para definir o gerente de cada departamento.

---

## Paginas e Componentes

### Paginas Novas

| Rota | Arquivo | Descricao |
|------|---------|-----------|
| `/dashboard/departamentos` | `DepartmentHub.tsx` | Hub de acesso - usuario ve apenas seu(s) departamento(s) |
| `/dashboard/departamentos/:id` | `DepartmentDetail.tsx` | Detalhes do departamento com despesas e verbas |
| `/dashboard/departamentos/:id/dashboard` | `DepartmentDashboard.tsx` | Dashboard financeiro do departamento |
| `/dashboard/departamentos/:id/aprovacoes` | `DepartmentApprovalHub.tsx` | Central de aprovacoes (para gerentes) |

### Componentes Novos

| Componente | Descricao |
|------------|-----------|
| `DepartmentExpenseCard.tsx` | Card de despesa |
| `DepartmentBudgetCard.tsx` | Card de verba |
| `NovaDespesaDepartamentoDialog.tsx` | Criar nova despesa |
| `SolicitarVerbaDepartamentoDialog.tsx` | Solicitar verba |
| `EnviarFinanceiroDepDialog.tsx` | Enviar ao financeiro |
| `AprovarDespesaDepartamentoDialog.tsx` | Aprovar despesa (gerente) |
| `DepartmentExpenseAttachments.tsx` | Anexos de despesa |

### Hooks Novos

| Hook | Descricao |
|------|-----------|
| `useDepartmentBudgets.ts` | CRUD de verbas por departamento |
| `useDepartmentExpenses.ts` | CRUD de despesas por departamento |
| `useDepartmentDashboard.ts` | Dados agregados do dashboard |
| `useUserDepartments.ts` | Departamentos do usuario logado |

---

## Fluxo de Acesso e Permissoes

### Hierarquia de Acesso

```text
FUNCIONARIO (membro do departamento)
  - Ver e criar despesas proprias
  - Anexar documentos
  - Enviar para aprovacao do gerente
  - Ver saldo de verba do departamento (apenas leitura)

GERENTE DO DEPARTAMENTO (responsavel_id)
  - Tudo do funcionario
  - Aprovar/rejeitar despesas de funcionarios
  - Enviar despesas aprovadas ao financeiro
  - Solicitar verba adicional
  - Ver dashboard do departamento

FINANCEIRO
  - Aprovar verbas de departamentos
  - Receber despesas na Central de Pagamentos
  - Aprovar pagamentos
  - Ver todos os departamentos
```

### Regras de Filtro (RLS)

- Funcionarios veem apenas despesas que criaram
- Gerentes veem todas as despesas do seu departamento
- Financeiro ve todas as despesas de todos os departamentos

---

## Integracao com Central de Pagamentos

As despesas aprovadas pelo gerente e enviadas ao financeiro aparecerao na tabela `financial_payment_queue` com:
- `source_type: 'department_expense'`
- `source_id: [expense.id]`
- `department_name: [nome do departamento]`

O financeiro revisa e aprova usando o mesmo fluxo ja existente, com exigencia de visualizar todos os anexos.

---

## Interface do Usuario

### Hub de Departamentos

O usuario acessa `/dashboard/departamentos` e ve:
- Lista de departamentos aos quais pertence
- Para cada departamento: KPIs rapidos (verba disponivel, despesas pendentes)
- Acesso rapido para criar despesa

### Detalhe do Departamento

Similar ao detalhe de evento:
- Tabs: Despesas | Verbas | Historico
- Botoes: Nova Despesa, Solicitar Verba
- Para gerentes: Central de Aprovacoes

### Dashboard do Departamento

Similar ao dashboard de eventos:
- KPIs: Verba total, utilizada, disponivel
- Grafico de evolucao de gastos
- Top categorias de despesas
- Lista de despesas recentes

---

## Etapas de Implementacao

### Fase 1: Banco de Dados
1. Criar tabela `department_budgets`
2. Criar tabela `department_expenses`
3. Criar triggers para auto-geracao de codigos
4. Criar politicas RLS
5. Criar bucket de storage `department-expense-docs`

### Fase 2: Backend (Hooks)
1. Criar `useDepartmentBudgets.ts`
2. Criar `useDepartmentExpenses.ts`
3. Criar `useUserDepartments.ts`
4. Criar `useDepartmentDashboard.ts`

### Fase 3: Componentes e Dialogs
1. Dialogs de criacao (despesa, verba)
2. Dialog de envio ao financeiro
3. Dialog de aprovacao
4. Componente de anexos
5. Cards de exibicao

### Fase 4: Paginas
1. Hub de departamentos
2. Detalhe do departamento
3. Dashboard financeiro
4. Central de aprovacoes

### Fase 5: Integracao
1. Atualizar `financial_payment_queue` para receber despesas de departamentos
2. Atualizar `PaymentReviewDialog` para exibir nome do departamento
3. Adicionar menu no sidebar
4. Configurar permissoes

---

## Consideracoes de Seguranca

1. **RLS Obrigatorio** - Funcionarios so veem suas proprias despesas
2. **Verificacao de Gerente** - Apenas `responsavel_id` pode aprovar
3. **Anexos Obrigatorios** - Despesas so podem ser enviadas ao financeiro com documentos anexados
4. **Confirmacao de Leitura** - Financeiro deve visualizar cada anexo antes de aprovar

---

## Beneficios

1. **Descentralizacao** - Cada departamento gerencia suas despesas
2. **Controle** - Gerentes tem visao e aprovacao de gastos
3. **Rastreabilidade** - Historico completo de despesas por departamento
4. **Integracao** - Fluxo unificado com Central de Pagamentos existente
5. **Verbas** - Controle de orcamento por departamento
6. **Auditoria** - Anexos obrigatorios e confirmacao de leitura

---

## Estimativa de Escopo

- Banco de dados: 2 tabelas + triggers + RLS
- Hooks: 4 novos hooks
- Componentes: ~10 componentes novos
- Paginas: 4 paginas novas
- Integracao: Atualizacoes em 2-3 componentes existentes
