
# Plano: Replicar Estrutura de Eventos para Cada Departamento

## Entendimento do Problema

Atualmente, o modulo de **Eventos Corporativos** tem a seguinte estrutura:

```
Sidebar:
  Eventos (expandivel)
    ├── Eventos (lista de eventos)
    └── Dashboard (dashboard financeiro)
```

Ao clicar em "Eventos", abre uma **landing page** com:
- KPIs (Total de Eventos, Eventos Ativos, Orcamento Total, Custo Realizado)
- Botoes: Dashboard, Aprovacoes, Solicitar Verba, Novo Evento
- Tabela listando todos os eventos

O modulo de **Departamentos** precisa ter a mesma estrutura para **cada departamento**.

---

## Solucao Proposta

### Nova Estrutura do Sidebar

```
Sidebar:
  Departamentos (expandivel)
    ├── Trade Marketing
    │     ├── Despesas (landing page)
    │     └── Dashboard
    ├── RH
    │     ├── Despesas
    │     └── Dashboard
    └── TI
          ├── Despesas
          └── Dashboard
```

### Fluxo de Navegacao

| Rota | Pagina | Funcao |
|------|--------|--------|
| `/dashboard/departamentos/:id` | DepartmentLanding (NOVA) | Landing page igual a CorporateEvents |
| `/dashboard/departamentos/:id/despesas/:despesaId` | DepartmentExpenseDetail (futura) | Detalhe da despesa |
| `/dashboard/departamentos/:id/dashboard` | DepartmentDashboard | Dashboard financeiro (ja existe) |
| `/dashboard/departamentos/:id/aprovacoes` | DepartmentApprovalHub | Hub de aprovacoes (ja existe) |

---

## Arquivos a Criar/Modificar

### 1. Criar: `DepartmentLanding.tsx`

Nova pagina que replica a estrutura de `CorporateEvents.tsx`:

```
+------------------------------------------------------------------+
| Departamento > Trade Marketing                                    |
+------------------------------------------------------------------+
| Trade Marketing                                                   |
| Gestao de despesas com controle de orcamento                     |
|                                                                   |
| [Dashboard] [Aprovacoes (3)] [Solicitar Verba] [+ Nova Despesa]  |
+------------------------------------------------------------------+
| KPIs:                                                             |
| Total Despesas | Despesas Ativas | Orcamento Total | Custo Real  |
+------------------------------------------------------------------+
| Lista de Despesas                           [Buscar despesas...] |
| +--------------------------------------------------------------+ |
| | Codigo | Categoria | Descricao | Valor | Status | Acoes      | |
| | DEP001 | Viagem    | ...       | 1.500 | Pend.  | [Ver]      | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

Elementos da landing page:
- Header com nome do departamento
- Botoes de acao: Dashboard, Aprovacoes, Solicitar Verba, Nova Despesa
- 4 KPIs: Total Despesas, Despesas Ativas, Orcamento Total, Custo Realizado
- Tabela de despesas com busca e filtros

### 2. Modificar: `AppSidebar.tsx`

Alterar a renderizacao dos departamentos para mostrar submenus:

```
Antes:
  {userDepartments.map((dept) => (
    <MenuItemLink to={`/dashboard/departamentos/${dept.id}`} title={dept.nome} />
  ))}

Depois:
  {userDepartments.map((dept) => (
    <Collapsible>
      <ModuleHeader title={dept.nome} />
      <CollapsibleContent>
        <MenuItemLink to={`/dashboard/departamentos/${dept.id}`} title="Despesas" />
        <MenuItemLink to={`/dashboard/departamentos/${dept.id}/dashboard`} title="Dashboard" />
      </CollapsibleContent>
    </Collapsible>
  ))}
```

### 3. Renomear Rota Existente

| Pagina Atual | Nova Funcao |
|--------------|-------------|
| `DepartmentDetail.tsx` | Renomear para `DepartmentLanding.tsx` |
| Manter estrutura existente | Ja tem despesas e verbas em tabs |

Na verdade, `DepartmentDetail.tsx` ja tem a estrutura correta de landing page! Apenas precisa:
1. Adicionar botao "Dashboard" no header
2. Ajustar o sidebar para mostrar submenus

---

## Modificacoes Detalhadas

### A. `AppSidebar.tsx` - Submenus por Departamento

Modificar a secao de Departamentos (linhas 727-761):

```typescript
{userDepartments.length > 0 && (
  <SidebarGroup className="py-2 px-2">
    {userDepartments.map((dept) => (
      <Collapsible key={dept.id}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[hsl(var(--module-departamentos)/0.1)]">
            <Building2 className="h-4 w-4 text-[hsl(var(--module-departamentos))]" />
            <span className="font-semibold text-sm">{dept.nome}</span>
            {dept.isManager && (
              <Badge variant="outline" className="ml-auto text-xs">Gerente</Badge>
            )}
            <ChevronDown className="h-4 w-4" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenu className="space-y-0.5 pl-4">
            <MenuItemLink 
              to={`/dashboard/departamentos/${dept.id}`} 
              icon={FileText} 
              title="Despesas" 
              colorKey="departamentos"
              end
            />
            <MenuItemLink 
              to={`/dashboard/departamentos/${dept.id}/dashboard`} 
              icon={BarChart3} 
              title="Dashboard" 
              colorKey="departamentos"
            />
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    ))}
  </SidebarGroup>
)}
```

### B. `DepartmentDetail.tsx` - Adicionar Botao Dashboard

Adicionar botao "Dashboard" no header (apos linha 110):

```typescript
<Button 
  variant="outline" 
  onClick={() => navigate(`/dashboard/departamentos/${id}/dashboard`)}
>
  <TrendingUp className="mr-2 h-4 w-4" />
  Dashboard
</Button>
```

### C. `DepartmentDashboard.tsx` - Ajustar Breadcrumb

Corrigir o breadcrumb para apontar para a landing do departamento:

```typescript
<ModuleBreadcrumb
  moduleName={department?.nome || "Departamento"}
  moduleHref={`/dashboard/departamentos/${id}`}
  currentPage="Dashboard Financeiro"
/>
```

### D. Verificar `DepartmentApprovalHub.tsx`

Garantir que o breadcrumb tambem aponte para a landing:

```typescript
<ModuleBreadcrumb
  moduleName={department?.nome || "Departamento"}
  moduleHref={`/dashboard/departamentos/${id}`}
  currentPage="Aprovacoes"
/>
```

---

## Resultado Final

### Navegacao do Sidebar

```
Departamentos
  └── Trade Marketing
        ├── Despesas (landing com tabela, KPIs, botoes)
        └── Dashboard (dashboard financeiro com graficos)
  └── RH
        ├── Despesas
        └── Dashboard
  └── TI
        ├── Despesas
        └── Dashboard
```

### Fluxo de Uso

1. Usuario clica em "Trade Marketing" no sidebar → expande submenu
2. Clica em "Despesas" → abre landing page com lista de despesas, KPIs e acoes
3. Pode clicar em "Dashboard" → abre dashboard financeiro com graficos
4. Pode clicar em "Aprovacoes" → abre hub de aprovacoes
5. Pode clicar em "Nova Despesa" → dialog para criar despesa
6. Pode clicar em "Solicitar Verba" → dialog para solicitar verba

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/dashboard/AppSidebar.tsx` | Transformar lista de departamentos em submenus expandiveis |
| `src/pages/DepartmentDetail.tsx` | Adicionar botao "Dashboard" no header |
| `src/pages/DepartmentDashboard.tsx` | Ajustar breadcrumb |
| `src/pages/DepartmentApprovalHub.tsx` | Ajustar breadcrumb |

---

## Comparacao Visual: Eventos vs Departamentos

### Eventos (modelo)

```
Sidebar:
  Eventos
    ├── Eventos (CorporateEvents.tsx - lista + KPIs)
    └── Dashboard (CorporateEventsDashboard.tsx)
```

### Departamentos (apos implementacao)

```
Sidebar:
  Trade Marketing
    ├── Despesas (DepartmentDetail.tsx - lista + KPIs)
    └── Dashboard (DepartmentDashboard.tsx)
  RH
    ├── Despesas
    └── Dashboard
```

A estrutura sera **identica**, com cada departamento funcionando como um "modulo de eventos" independente.
