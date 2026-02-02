
# Excluir/Inativar Verbas com Historico de Auditoria

## Resumo

Adicionar funcionalidade para excluir ou inativar verbas (budgets) na tela de Verbas Semestrais. Verbas inativas serao exibidas com um risco vermelho (line-through) e nao aparecerao nas demais telas ou controles financeiros do sistema.

## Alteracoes no Banco de Dados

### 1. Adicionar campos de exclusao/inativacao na tabela trade_budgets

| Campo | Tipo | Descricao |
|-------|------|-----------|
| inactivated_at | TIMESTAMP | Data/hora da inativacao |
| inactivated_by | UUID | Usuario que inativou |
| inactivated_reason | TEXT | Motivo da inativacao |

### 2. Criar tabela de auditoria para verbas

```text
trade_budget_audit_log
+----------------+-------------+---------------------------------+
| Campo          | Tipo        | Descricao                       |
+----------------+-------------+---------------------------------+
| id             | UUID        | Identificador unico             |
| budget_id      | UUID        | Referencia a verba              |
| action         | TEXT        | Acao: inactivate, reactivate,   |
|                |             | update, delete                  |
| field_changed  | TEXT        | Campo alterado                  |
| old_value      | TEXT        | Valor anterior                  |
| new_value      | TEXT        | Novo valor                      |
| user_id        | UUID        | Usuario que fez a alteracao     |
| user_name      | TEXT        | Nome do usuario                 |
| created_at     | TIMESTAMP   | Data/hora do registro           |
+----------------+-------------+---------------------------------+
```

## Alteracoes na Interface

### Tela TradeVerbasSemestrais.tsx

1. **Nova coluna "Acoes" na tabela** com menu dropdown contendo:
   - Editar verba
   - Inativar verba (se ativa)
   - Reativar verba (se inativa)
   - Excluir verba (soft delete)

2. **Estilo visual para verbas inativas**:
   - Linha da tabela com opacity reduzida (opacity-50)
   - Texto com line-through vermelho
   - Badge "Inativa" em vermelho
   - Exibida apenas se filtro "Mostrar inativas" estiver ativo

3. **Filtro "Mostrar verbas inativas"**:
   - Toggle para exibir/ocultar verbas inativas na listagem
   - Por padrao, mostra apenas verbas ativas

4. **Dialog de confirmacao para inativar/excluir**:
   - Campo obrigatorio de motivo
   - Aviso sobre impacto nos relatorios

### TradeVerbaCard (Dashboard)

- Filtrar verbas onde `status = 'active'` E `inactivated_at IS NULL`

### Demais Telas e Hooks

Atualizar queries para filtrar verbas inativas:

| Arquivo | Alteracao |
|---------|-----------|
| useTradeFinanceiroDashboard.ts | Adicionar `.is("inactivated_at", null)` |
| useTradeData.ts | Adicionar `.is("inactivated_at", null)` |
| TradeAdminModule.tsx | Adicionar `.is("inactivated_at", null)` |
| NovoLancamentoDialog.tsx | Ja filtra por status active |
| EditarLancamentoDialog.tsx | Ja filtra por status active |
| TradeCampaigns.tsx | Ja filtra por status active |

## Funcoes de Auditoria

Adicionar em `src/lib/auditLog.ts`:

```text
logBudgetInactivate(budgetId, budgetName, reason)
logBudgetReactivate(budgetId, budgetName)
logBudgetDelete(budgetId, budgetName, reason)
logBudgetEdit(budgetId, changedFields[])
```

## Fluxo de Inativacao

```text
1. Usuario clica "Inativar" no menu de acoes
2. Dialog de confirmacao abre com campo de motivo
3. Usuario preenche motivo e confirma
4. Sistema atualiza:
   - status: "inactive"
   - inactivated_at: now()
   - inactivated_by: user.id
   - inactivated_reason: motivo
5. Sistema registra no audit log
6. Toast de sucesso
7. Lista atualizada
```

## Fluxo de Reativacao

```text
1. Usuario ativa filtro "Mostrar inativas"
2. Clica "Reativar" no menu de acoes
3. Sistema atualiza:
   - status: "active"
   - inactivated_at: null
   - inactivated_by: null
   - inactivated_reason: null
5. Sistema registra no audit log
6. Toast de sucesso
```

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| supabase/migrations/xxx.sql | Migration com alteracoes no banco |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| src/pages/TradeVerbasSemestrais.tsx | Menu de acoes, dialogs, filtros, estilos |
| src/lib/auditLog.ts | Novas funcoes para verbas |
| src/hooks/useTradeFinanceiroDashboard.ts | Filtrar inativas |
| src/hooks/useTradeData.ts | Filtrar inativas |
| src/pages/modules/TradeAdminModule.tsx | Filtrar inativas |
| src/integrations/supabase/types.ts | Atualizado automaticamente |

## Seguranca

- Apenas usuarios com permissao `trade_admin` podem inativar/excluir verbas
- Todas as acoes sao registradas no historico com usuario e timestamp
- Soft delete preserva dados para auditoria futura
