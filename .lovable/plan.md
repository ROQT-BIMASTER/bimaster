

## Dados de Contas a Pagar não atualizam após sincronização

### Problema
O hook `useContasPagarSync` sincroniza dados via N8N ou API direta, mas nunca invalida o cache do React Query. As queries em `ContasAPagar.tsx` e `ContasPagarDREView.tsx` usam keys como `contas-pagar-dashboard`, `contas-pagar-table`, `contas-pagar-calendario` e `contas-pagar-dre-view` -- todas permanecem com dados antigos no cache.

### Solução
Adicionar `queryClient.invalidateQueries()` no hook `useContasPagarSync.ts` após cada sincronização bem-sucedida (tanto `syncDirect` quanto `fetchStats`).

### Alteração

**`src/hooks/useContasPagarSync.ts`**:

1. Importar `useQueryClient` do `@tanstack/react-query`
2. Inicializar `const queryClient = useQueryClient()` no hook
3. Após sync bem-sucedida no `syncDirect`, invalidar todas as queries relevantes:

```typescript
queryClient.invalidateQueries({ queryKey: ['contas-pagar-dashboard'] });
queryClient.invalidateQueries({ queryKey: ['contas-pagar-table'] });
queryClient.invalidateQueries({ queryKey: ['contas-pagar-calendario'] });
queryClient.invalidateQueries({ queryKey: ['contas-pagar-dre-view'] });
queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
queryClient.invalidateQueries({ queryKey: ['lancamentos-dre'] });
```

Isso garante que qualquer tela aberta com dados de contas a pagar refaça a consulta automaticamente após a sincronização.

### Arquivo
- `src/hooks/useContasPagarSync.ts`

