# Plano de Implementação - Multi-Filial e Central de Aprovações

## ✅ Concluído

### 1. Multi-Filial em Telas de Criação
- ✅ Migração SQL - Colunas empresa_id/empresa_nome adicionadas
- ✅ NovoEventoDialog.tsx - Seletor de filial
- ✅ NovaDespesaEventoDialog.tsx - Seletor de filial
- ✅ SolicitarVerbaDepartamentoDialog.tsx - Seletor de filial
- ✅ NovoLancamentoDialog.tsx - Seletor de filial
- ✅ SolicitarOrcamentoDialog.tsx - Seletor de filial
- ✅ Hooks atualizados (useCorporateEvents, useEventExpenses, useDepartmentBudgets)

### 2. Central de Aprovações Unificada de Departamentos
- ✅ Hook useManagerPendingExpenses.ts criado
- ✅ Página DepartmentsApprovalHub.tsx criada
- ✅ Rota /dashboard/departamentos/aprovacoes adicionada
- ✅ Botão "Central de Aprovações" no DepartmentHub.tsx

## 📋 Pendente (Prioridade Baixa)

### Telas de Edição (futuro)
- EditarLancamentoDialog.tsx - Exibir/editar filial
- EditarInvestimentoDialog.tsx - Exibir/editar filial

### Outras Telas (futuro)
- NovaVisitaDialog.tsx
- NovoSellOutDialog.tsx
- NovaPromocaoDialog.tsx

### Menu Lateral (opcional)
- AppSidebar.tsx - Link para Central de Aprovações no submenu

