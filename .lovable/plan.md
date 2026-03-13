

# Garantir que Todos os Módulos Apareçam no Sistema

## Diagnóstico

Após análise completa do código, encontrei duas lacunas:

### 1. Módulo Estoque — sem rotas e sem sidebar
O módulo `estoque` tem uma página (`EstoqueModule.tsx`) e está no `DashboardRedirect`, mas:
- **Não tem nenhuma rota em `App.tsx`** — acessar `/dashboard/estoque` dá 404
- **Não tem entrada no sidebar** (`AppSidebar.tsx`) — não aparece no menu lateral

### 2. DashboardRedirect incompleto
O redirecionamento inicial (`DashboardRedirect.tsx`) não inclui 5 módulos que existem no sidebar e têm rotas:
- `china` → `/dashboard/fabrica-china`
- `eventos` → `/dashboard/eventos`
- `departamentos` → `/dashboard/departamentos`
- `projetos` → `/dashboard/projetos`
- `reunioes` → `/dashboard/reunioes`

Usuários com permissão apenas nesses módulos nunca são redirecionados corretamente ao fazer login.

## Alterações

### Arquivo 1: `src/App.tsx`
- Adicionar rotas do módulo Estoque protegidas com `ModuleRoute moduleCode="estoque"`:
  - `/dashboard/estoque` → `EstoqueModule`
  - `/dashboard/estoque/distribuidoras`
  - `/dashboard/estoque/produtos-master`
  - `/dashboard/estoque/saldos`
  - `/dashboard/estoque/consolidado`
  - `/dashboard/estoque/vinculacoes`
- Adicionar os lazy imports necessários para as páginas de Estoque

### Arquivo 2: `src/components/dashboard/AppSidebar.tsx`
- Adicionar seção do módulo Estoque no sidebar com `showModule("estoque")`, incluindo links para as sub-páginas (Distribuidoras, Produtos Master, Saldos, Consolidado, Vinculações)
- Adicionar `estoque` na lista `moduleFilterOptions` (filtro de módulos)

### Arquivo 3: `src/components/auth/DashboardRedirect.tsx`
- Adicionar os 5 módulos faltantes no array `MODULE_ROUTES`:
  - `{ code: "china", path: "/dashboard/fabrica-china" }`
  - `{ code: "eventos", path: "/dashboard/eventos" }`
  - `{ code: "departamentos", path: "/dashboard/departamentos" }`
  - `{ code: "projetos", path: "/dashboard/projetos" }`
  - `{ code: "reunioes", path: "/dashboard/reunioes" }`

## Resultado
Todos os 13 módulos (prospects, financeiro, marketing, trade, fabrica, china, comercial, eventos, departamentos, precos, projetos, reunioes, **estoque**) ficarão visíveis no sidebar, acessíveis via URL e com redirecionamento correto no login.

