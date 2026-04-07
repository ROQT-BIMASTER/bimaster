# Corrigir Bug de Flickering ao Salvar Loja

## Problema

Após salvar a edição de uma loja (com supervisor e vendedor), o sistema fica "piscando" em loop. A causa está no ciclo de re-fetch:

1. `handleSubmit` chama `onSuccess()` → `refetchStores()` → `setLoading(true)` + `refetchFilteredStores()`
2. Quando `filteredStores` muda (nova referência do array), o `useEffect` em `TradeStores.tsx` dispara novamente o `fetchStoreDetails`
3. Isso pode gerar re-renders em cascata, especialmente se a referência de `filteredStores` muda a cada refetch

Além disso, o delete+insert de `store_sellers` pode falhar silenciosamente por RLS, e erros não são tratados adequadamente.

## Solução

### 1. `EditarLojaDialog.tsx` — Melhorar tratamento de erros e UX de salvamento

- Envolver toda a lógica de save (update store + delete/insert store_sellers) em um único try/catch
- Se o delete ou insert de `store_sellers` falhar, lançar erro em vez de apenas `console.error`
- Adicionar overlay de "Salvando..." sobre o dialog durante a operação
- Desabilitar todos os campos do formulário enquanto `loading === true`
- Só chamar `onOpenChange(false)` e `onSuccess()` após **todas** as operações concluírem com sucesso

### 2. `TradeStores.tsx` — Estabilizar o ciclo de refetch

- No `refetchStores`, em vez de `setLoading(true)` + `refetchFilteredStores()`, usar o resultado do refetch diretamente para atualizar `allStores`/`stores` sem depender do useEffect em cascata
- Adicionar guard no `useEffect` para não re-executar se os IDs das lojas não mudaram (comparar IDs em vez de referência do array)
- Alternativa mais simples: usar `useCallback` com deps estáveis e um flag `isRefetching` para evitar re-renders duplos

### 3. `VendedorMultiSelect.tsx` — Prevenir re-fetch desnecessário

- O `fetchVendedores` roda dentro de um `useEffect` com dep `isAdminOrSupervisor` — se o role flip durante o save, isso causa re-render. Adicionar guard de `loading` para não re-executar durante save.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/trade/EditarLojaDialog.tsx` | Tratar erros de store_sellers como fatais, overlay de salvando, desabilitar form |
| `src/pages/TradeStores.tsx` | Estabilizar refetch — comparar IDs ao invés de referência, evitar loading flash |
