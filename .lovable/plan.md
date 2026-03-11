

## Proteção Automática de Módulos — Prevenção de Falhas Futuras

### Problema
Atualmente, cada módulo no sidebar precisa manualmente incluir `hasModulePermission("código") && showModule("código")`. Se um desenvolvedor esquecer o `hasModulePermission`, o módulo fica visível para todos — como aconteceu com o módulo China.

### Solução
Unificar a lógica: fazer com que `showModule` já inclua automaticamente a verificação de permissão. Assim, é impossível exibir um módulo sem permissão.

### Alterações

**1. `AppSidebar.tsx` — Refatorar `showModule` para incluir permissão automaticamente**

Alterar a função `showModule` de:
```ts
const showModule = (code: string) => selectedModules.size === 0 || selectedModules.has(code);
```
Para:
```ts
const showModule = (code: string) => 
  hasModulePermission(code) && (selectedModules.size === 0 || selectedModules.has(code));
```

Depois, remover todos os `hasModulePermission("xxx") &&` duplicados das ~12 ocorrências no JSX, pois `showModule` já faz essa verificação. Cada bloco ficará mais limpo:
```tsx
// Antes:
{hasModulePermission("financeiro") && showModule("financeiro") && (
// Depois:
{showModule("financeiro") && (
```

Isso garante que **qualquer novo módulo** adicionado com `showModule("novo")` já estará protegido por permissão automaticamente, sem depender do desenvolvedor lembrar de adicionar `hasModulePermission`.

**2. `App.tsx` — Criar helper para rotas protegidas por módulo**

Criar um componente wrapper reutilizável no topo do arquivo para simplificar as rotas:
```tsx
const ModuleRoute = ({ moduleCode, children }: { moduleCode: string; children: React.ReactNode }) => (
  <ProtectedRoute>
    <ModuleProtectedRoute moduleCode={moduleCode}>
      {children}
    </ModuleProtectedRoute>
  </ProtectedRoute>
);
```

Isso reduz verbosidade e garante que o padrão correto seja sempre seguido ao adicionar novas rotas. Uso:
```tsx
// Antes:
<Route path="/dashboard/fabrica-china" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="china"><ChinaFabrica /></ModuleProtectedRoute></ProtectedRoute>} />
// Depois:
<Route path="/dashboard/fabrica-china" element={<ModuleRoute moduleCode="china"><ChinaFabrica /></ModuleRoute>} />
```

### Resultado
- Novos módulos ficam protegidos automaticamente no sidebar
- Rotas ficam mais simples e consistentes com o helper `ModuleRoute`
- Elimina a possibilidade de erro humano ao esquecer verificação de permissão

