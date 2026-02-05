

# Central de Aprovações Unificada para Gerentes de Departamentos

## O Problema
Atualmente, um gerente responsável por múltiplos departamentos precisa navegar individualmente a cada departamento (`/dashboard/departamentos/{id}/aprovacoes`) para aprovar despesas pendentes. Isso é ineficiente e propenso a esquecimentos.

## A Solução
Criar uma **Central de Aprovações de Departamentos Unificada** que consolida todas as despesas pendentes de todos os departamentos onde o usuário é gerente, em uma única tela.

## Design Visual

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                      Central de Aprovações de Departamentos                  │
│                      Revise e aprove despesas de todos os seus departamentos │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │     12       │   │   R$ 45.230  │   │      3       │   │   Gerente    │  │
│  │   Pendentes  │   │ Valor Total  │   │ Departamentos│   │  Logado      │  │
│  └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Filtros: [Todos Departamentos ▼]  [Todas Categorias ▼]  [Buscar...]    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Código    │ Departamento │ Categoria  │ Solicitante │ Valor │ Ações   │  │
│  ├───────────┼──────────────┼────────────┼─────────────┼───────┼─────────│  │
│  │ DEP-0001  │ Logística    │ Transporte │ João Silva  │ 1.500 │ Revisar │  │
│  │ DEP-0002  │ Marketing    │ Viagem     │ Maria Santos│ 3.200 │ Revisar │  │
│  │ DEP-0003  │ Logística    │ Material   │ Pedro Costa │   850 │ Revisar │  │
│  │ DEP-0004  │ RH           │ Treinamento│ Ana Lima    │ 5.000 │ Revisar │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Criar/Modificar

### 1. Novo Hook: `src/hooks/useManagerPendingExpenses.ts`
Busca todas as despesas pendentes de todos os departamentos onde o usuário é gerente.

```typescript
// Lógica principal:
// 1. Identificar departamentos onde user é responsável OU é admin
// 2. Buscar despesas com status = 'pending' desses departamentos
// 3. Retornar agregado com métricas
```

### 2. Nova Página: `src/pages/DepartmentsApprovalHub.tsx`
Central unificada de aprovações (note o "s" - Departments vs Department).

**Funcionalidades:**
- KPIs consolidados (total pendente, valor total, número de departamentos)
- Tabela unificada com coluna de "Departamento"
- Filtro por departamento específico
- Filtro por categoria
- Reutiliza `AprovarDespesaDepartamentoDialog` existente

### 3. Atualizar Rotas: `src/App.tsx`
Adicionar nova rota: `/dashboard/departamentos/aprovacoes`

### 4. Atualizar Navegação: `src/pages/DepartmentHub.tsx`
Adicionar botão "Central de Aprovações" para gerentes de múltiplos departamentos ou admins.

### 5. Atualizar Menu Lateral: `src/components/dashboard/AppSidebar.tsx`
Adicionar link para Central de Aprovações no submenu de Departamentos (apenas para gerentes).

## Lógica de Acesso

```text
┌─────────────────────────────────────────────────────────────────┐
│                    QUEM VÊ A CENTRAL UNIFICADA?                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ADMIN / SUPERVISOR                                             │
│  └─ Vê despesas pendentes de TODOS os departamentos             │
│                                                                 │
│  GERENTE (responsável de 1+ departamentos)                      │
│  └─ Vê despesas pendentes apenas dos seus departamentos         │
│                                                                 │
│  FUNCIONÁRIO COMUM                                              │
│  └─ NÃO tem acesso à central (redireciona para hub)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Fluxo de Navegação Atualizado

```text
ANTES:
Hub Departamentos → Clica Dept A → Aprovações Dept A
Hub Departamentos → Clica Dept B → Aprovações Dept B  (precisa voltar e clicar)
Hub Departamentos → Clica Dept C → Aprovações Dept C  (precisa voltar e clicar)

DEPOIS:
Hub Departamentos → Central de Aprovações → Vê TODAS as pendentes de A, B e C
                                          → Filtra se quiser por departamento
```

## Detalhes Técnicos

### Hook useManagerPendingExpenses

```typescript
export function useManagerPendingExpenses() {
  return useQuery({
    queryKey: ["manager-pending-expenses"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { expenses: [], departments: [], metrics: {} };

      // Verificar se é admin/supervisor
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const isAdminOrSupervisor = 
        roleData?.role === "admin" || roleData?.role === "supervisor";

      // Buscar departamentos onde é gerente
      let departmentsQuery = supabase
        .from("departamentos")
        .select("id, nome")
        .eq("ativo", true);

      if (!isAdminOrSupervisor) {
        departmentsQuery = departmentsQuery.eq("responsavel_id", user.id);
      }

      const { data: departments } = await departmentsQuery;
      if (!departments?.length) return { expenses: [], departments: [], metrics: {} };

      // Buscar despesas pendentes desses departamentos
      const departmentIds = departments.map(d => d.id);
      const { data: expenses } = await supabase
        .from("department_expenses")
        .select(`
          *,
          department:departamentos(id, nome),
          empresa:empresas(id, nome)
        `)
        .in("department_id", departmentIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      // Buscar criadores
      const creatorIds = [...new Set(expenses?.map(e => e.created_by).filter(Boolean))];
      // ... fetch creators

      return {
        expenses: enrichedExpenses,
        departments,
        metrics: {
          totalPending: expenses?.length || 0,
          totalValue: expenses?.reduce((sum, e) => sum + (e.valor_realizado || e.valor_previsto || 0), 0) || 0,
          departmentsCount: departments.length,
        },
      };
    },
  });
}
```

### Componente DepartmentsApprovalHub

Seguirá o padrão visual do `TradeApprovalHub` com:
- Cards de KPIs no topo
- Filtros por departamento e categoria
- Tabela com colunas: Código, Departamento, Filial, Categoria, Descrição, Solicitante, Valor, Ações
- Reutiliza `AprovarDespesaDepartamentoDialog` para o fluxo de aprovação

## Benefícios

1. **Eficiência**: Gerente aprova tudo em uma única tela
2. **Visibilidade**: KPIs consolidados de todos os departamentos
3. **Consistência**: Segue padrão já existente no Trade e Eventos
4. **Flexibilidade**: Ainda mantém a central individual por departamento para casos específicos

## Ordem de Implementação

1. Criar hook `useManagerPendingExpenses`
2. Criar página `DepartmentsApprovalHub`
3. Adicionar rota em `App.tsx`
4. Adicionar link no `DepartmentHub` e menu lateral
5. Testar fluxo completo

