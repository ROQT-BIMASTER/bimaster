

# Contas a Receber — Correcao Completa

## Problemas Identificados

### 1. Loop infinito no AppSidebar (CRITICO)
O `useEffect` na linha 448-467 do `AppSidebar.tsx` tem `hasModulePermission` como dependencia. Essa funcao muda de identidade quando o `PermissionsContext` atualiza (loading → ready), disparando `setTabelasPendentes(0)` → re-render → nova identidade da funcao → loop infinito.

O console confirma: `Maximum update depth exceeded` apontando para `AppSidebar.tsx:733`.

### 2. RLS e dados (JA CORRIGIDO)
A migration anterior ja aplicou a policy otimizada, o GRANT e o indice. Nao ha statement timeouts nos logs recentes.

## Solucao

### Arquivo: `src/components/dashboard/AppSidebar.tsx`

**Correcao 1** — Estabilizar a dependencia do useEffect (linha 448-467):
Remover `hasModulePermission` da lista de dependencias e usar `useRef` para armazenar a funcao, evitando que mudancas de identidade da funcao disparem o effect.

```tsx
// Antes:
useEffect(() => {
  if (loading || !hasModulePermission("precos")) {
    setTabelasPendentes(0);
    return;
  }
  // ...
}, [loading, hasModulePermission]);

// Depois:
const hasModulePermRef = useRef(hasModulePermission);
hasModulePermRef.current = hasModulePermission;

useEffect(() => {
  if (loading || !hasModulePermRef.current("precos")) {
    setTabelasPendentes(0);
    return;
  }
  // ... (mesmo codigo)
}, [loading]);
```

### Arquivo: `src/contexts/ImpersonationContext.tsx`

**Correcao 2** — Estabilizar `hasModulePermission` e `hasScreenPermission` (linhas 198-213):
Usar dependencias granulares em vez de `realPermissions` (objeto inteiro):

```tsx
// Antes:
}, [impersonatedPermissions, realPermissions]);

// Depois:
}, [impersonatedPermissions, realPermissions.isAdmin, realPermissions.hasModulePermission]);
```

Mesma correcao para `hasScreenPermission`.

## Resultado Esperado

- Loop infinito eliminado — a pagina renderiza normalmente
- Sidebar estavel sem re-renders excessivos
- Dados do Contas a Receber carregam (RLS ja otimizada na migration anterior)
- Dashboard, Calendario e Tabela funcionais

