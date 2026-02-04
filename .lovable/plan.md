
# Plano: Padronizar Dashboard de Departamentos (Identico a Eventos)

## Problema Identificado

A tela de detalhes do departamento apresenta "Departamento nao encontrado" porque:

1. O hook `useDepartmentById` tenta fazer um JOIN com `profiles` usando uma Foreign Key inexistente:
   ```typescript
   responsavel:profiles!departamentos_responsavel_id_fkey(id, nome)
   ```

2. A tabela `departamentos` NAO possui Foreign Key para `profiles.id` no campo `responsavel_id`

3. O Dashboard de Departamentos atual tem estrutura diferente do Dashboard de Eventos

---

## Solucao Completa

### Fase 1: Banco de Dados

Criar a Foreign Key que falta:

```sql
ALTER TABLE public.departamentos
ADD CONSTRAINT departamentos_responsavel_id_fkey 
FOREIGN KEY (responsavel_id) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;
```

### Fase 2: Corrigir Hook `useDepartmentById`

Adicionar verificacao de admin (igual a eventos):

```text
ANTES:
const isManager = data.responsavel_id === user.id;

DEPOIS:
const { data: roleData } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .maybeSingle();

const isAdmin = roleData?.role === "admin";
const isManager = isAdmin || data.responsavel_id === user.id;
```

### Fase 3: Criar Hook `useDepartmentDashboard`

Novo hook que replica a estrutura de `useEventsDashboard`:

| Dado | Origem | Descricao |
|------|--------|-----------|
| verbas | department_budgets | Verbas ativas do departamento |
| verbaMetrics | Calculado | Total orcado, utilizado, disponivel, % |
| despesaMetrics | Calculado | Qtd despesas, pendentes, pagas, % pago |
| fluxoCaixa | Calculado | Entradas/saidas ultimos 6 meses |
| despesasPorCategoria | Calculado | Agrupamento por categoria |
| despesas | department_expenses | Lista formatada para tabela |

### Fase 4: Criar Componentes de Dashboard

Replicar os 4 componentes do dashboard de eventos:

| Componente Eventos | Componente Departamentos | Funcao |
|--------------------|--------------------------|--------|
| EventsVerbaCard | DeptVerbaCard | Card com KPIs de verba (Total, Utilizado, Disponivel) |
| EventsDespesasCard | DeptDespesasCard | Card com KPIs de despesas (Qtd, Pendentes, Pagas) |
| EventsFluxoCaixaChart | DeptFluxoCaixaChart | Grafico de barras + linha (Entradas, Saidas, Saldo) |
| EventsDespesasTable | DeptDespesasTable | Tabela com busca, filtro e exportacao |

### Fase 5: Reescrever `DepartmentDashboard.tsx`

A nova pagina tera exatamente a mesma estrutura visual do Dashboard de Eventos:

```text
+------------------------------------------------------------------+
| < Voltar   Departamento > Dashboard Financeiro                   |
+------------------------------------------------------------------+
| Dashboard Financeiro [Nome Dept]      [Periodo] [Atualizar] [+]  |
| Visao consolidada de verbas e despesas                           |
| Periodo: 01/01/2026 ate 04/02/2026                               |
+------------------------------------------------------------------+
|                                                                  |
|  +---------------------------+  +------------------------------+ |
|  | Verbas do Departamento    |  | Despesas por Categoria       | |
|  | Total | Utilizado | Disp  |  | Qtd | Ativos | Pend | Pago   | |
|  | R$X   | R$Y       | R$Z   |  | XX  | YY     | R$A  | R$B    | |
|  |                           |  |                              | |
|  | [Barra de Progresso]      |  | [Barra de Progresso]         | |
|  |                           |  |                              | |
|  | verba 1        R$ X.XXX   |  | Categoria 1      R$ XXX     | |
|  | verba 2        R$ Y.YYY   |  | Categoria 2      R$ YYY     | |
|  +---------------------------+  +------------------------------+ |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | Fluxo de Caixa [Nome Dept]        Entradas | Saidas | Saldo|  |
|  | Ultimos 6 meses                   R$X.XXX  | R$Y.YY | R$Z  |  |
|  |                                                            |  |
|  |  [GRAFICO: Barras verdes/vermelhas + Linha azul saldo]     |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | Despesas do Departamento                        [Exportar] |  |
|  | [Buscar por categoria ou descricao]   [Filtro Status]      |  |
|  |                                                            |  |
|  | Categoria | Descricao | Valor Realizado | Status | Data   |  |
|  | --------- | --------- | --------------- | ------ | -----  |  |
|  | Viagem    | Desc 1    | R$ 1.500,00     | Pago   | 01/02  |  |
|  |                                                            |  |
|  | Exibindo X de Y despesas    Total Realizado: R$ Z.ZZZ,ZZ  |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Arquivos a Criar/Modificar

### Criar Novos

| Arquivo | Descricao |
|---------|-----------|
| `src/hooks/useDepartmentDashboard.ts` | Hook de dados do dashboard |
| `src/components/departments/dashboard/DeptVerbaCard.tsx` | Card de verbas |
| `src/components/departments/dashboard/DeptDespesasCard.tsx` | Card de despesas |
| `src/components/departments/dashboard/DeptFluxoCaixaChart.tsx` | Grafico fluxo de caixa |
| `src/components/departments/dashboard/DeptDespesasTable.tsx` | Tabela de despesas |

### Modificar

| Arquivo | Alteracao |
|---------|-----------|
| Migration SQL | Adicionar FK `departamentos_responsavel_id_fkey` |
| `src/hooks/useUserDepartments.ts` | Adicionar verificacao de admin no `useDepartmentById` |
| `src/pages/DepartmentDashboard.tsx` | Reescrever com nova estrutura |

---

## Detalhes Tecnicos

### Hook `useDepartmentDashboard`

```typescript
interface DepartmentDashboardParams {
  departmentId: string;
  dateRange?: DateRangeFilter;
}

interface VerbaMetrics {
  totalOrcado: number;
  totalUtilizado: number;
  saldoDisponivel: number;
  percentualUtilizado: number;
}

interface DespesaMetrics {
  qtdDespesas: number;
  despesasAtivas: number; // approved, pending
  valorPendente: number;
  valorPago: number;
  percentualPago: number;
}

interface FluxoCaixaItem {
  mes: string;
  entradas: number; // verbas liberadas
  saidas: number;   // despesas pagas
  saldo: number;    // acumulado
}

return {
  verbas,
  verbaMetrics,
  despesaMetrics,
  fluxoCaixa,
  despesasPorCategoria,
  despesas,
  isLoading,
  error,
}
```

### Adaptacoes do Card de Despesas

O Dashboard de Eventos mostra "Despesas por Evento" (agrupado por evento).
O Dashboard de Departamentos mostrara "Despesas por Categoria" (agrupado por categoria), ja que cada departamento nao tem sub-eventos.

### Filtro de Periodo

Implementar o mesmo seletor de periodo usado em Eventos:
- Este mes
- Ultimos 30 dias
- Ultimos 90 dias
- Este ano
- Personalizado

### Botoes do Header

| Botao | Rota | Condicao |
|-------|------|----------|
| Atualizar | - | Sempre visivel |
| Aprovacoes | `/dashboard/departamentos/:id/aprovacoes` | Apenas se `isManager && pendingCount > 0` |
| Nova Despesa | - | Abre dialog |

---

## Sequencia de Implementacao

1. Criar migracao SQL com a FK
2. Atualizar `useDepartmentById` com verificacao de admin
3. Criar `useDepartmentDashboard.ts`
4. Criar componentes de dashboard (4 arquivos)
5. Reescrever `DepartmentDashboard.tsx`
6. Testar fluxo completo

---

## Resultado Esperado

- Admin acessa qualquer departamento
- Dashboard identico visualmente ao de Eventos
- Seletor de periodo funcional
- Grafico de fluxo de caixa com entradas/saidas
- Tabela de despesas com busca, filtro e exportacao
- Botoes de acao no header (Atualizar, Aprovacoes, Nova Despesa)

