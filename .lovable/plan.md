

## Problema Identificado

O módulo **Fábrica China** está acessível a todos os usuários autenticados por **duas falhas de segurança**:

1. **Sidebar (AppSidebar.tsx, linha 762):** Todos os outros módulos usam `hasModulePermission("código") && showModule("código")`, mas o módulo China usa apenas `showModule("china")` — sem verificação de permissão.

2. **Rotas (App.tsx, linhas 414-421):** Todas as rotas `/dashboard/fabrica-china/*` usam apenas `<ProtectedRoute>` (autenticação), sem `<ModuleProtectedRoute moduleCode="china">` (autorização). Qualquer usuário logado pode acessar via URL direta.

## Plano de Correção

### 1. Corrigir visibilidade no Sidebar
Em `AppSidebar.tsx`, linha 762, adicionar a verificação de permissão:
```
// De:
{showModule("china") && (
// Para:
{hasModulePermission("china") && showModule("china") && (
```

### 2. Proteger todas as rotas China
Em `App.tsx`, envolver todas as 8 rotas fabrica-china com `ModuleProtectedRoute`:
```tsx
<Route path="/dashboard/fabrica-china" element={
  <ProtectedRoute>
    <ModuleProtectedRoute moduleCode="china">
      <ChinaFabrica />
    </ModuleProtectedRoute>
  </ProtectedRoute>
} />
// Repetir para todas as rotas: /nova, /nova/:id, /recebimentos, /ordens, /ordens/:id, /submissao/:id, /produto/:id
```

### 3. Verificar permissões no banco
Confirmar que o módulo `china` existe na tabela de módulos e que as permissões estão atribuídas apenas aos usuários corretos (equipe China).

Nenhuma alteração de banco de dados é necessária — apenas correção de código frontend para aplicar os guards que já existem no sistema.

