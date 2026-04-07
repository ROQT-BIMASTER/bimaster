
# Corrigir Bug de Flickering ao Salvar Edição de Loja

## Problema

Após salvar a edição de uma loja com supervisor e vendedor, o sistema fica "piscando" em loop. Causas identificadas:

1. **Erros silenciosos no `store_sellers`**: O delete+insert de vendedores usa `console.error` mas não interrompe o fluxo — o dialog fecha, chama `onSuccess`, mas os dados ficam inconsistentes, gerando re-renders
2. **Ciclo de refetch em cascata**: `refetchStores()` seta `loading=true` e chama `refetchFilteredStores()`, que muda a referência de `filteredStores`, disparando o `useEffect` que chama `fetchStoreDetails` novamente — loop de re-render
3. **Dialog fecha antes de concluir**: O dialog fecha e dispara `onSuccess` mesmo se as operações de `store_sellers` falharem

## Solução

### 1. `EditarLojaDialog.tsx` — Tratar erros como fatais + UX de salvamento

- Transformar erros de `store_sellers` (delete e insert) em `throw` em vez de `console.error`
- Adicionar overlay visual "Salvando..." com spinner sobre todo o dialog durante a operação
- Desabilitar botões e campos enquanto `loading === true`
- Só fechar dialog e chamar `onSuccess` após **todas** as operações concluírem
- Adicionar pequeno delay (`setTimeout 300ms`) entre fechar o dialog e chamar `onSuccess` para evitar flash

### 2. `TradeStores.tsx` — Estabilizar ciclo de refetch

- No `useEffect` que depende de `filteredStores`, comparar os IDs das lojas retornadas com os atuais antes de chamar `fetchStoreDetails` — se os IDs são os mesmos, não re-executar
- No `refetchStores`, controlar o estado de loading de forma mais granular (usar flag `isRefetching` separado do `loading` principal)

### 3. Feedback visual durante salvamento

- Mostrar texto "Salvando..." no botão de submit (já existe parcialmente)
- Adicionar `pointer-events-none` e `opacity-50` ao form durante save

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/trade/EditarLojaDialog.tsx` | Tratar erros de store_sellers como fatais, overlay de salvando, delay no onSuccess |
| `src/pages/TradeStores.tsx` | Estabilizar useEffect com comparação de IDs, evitar flash de loading |
