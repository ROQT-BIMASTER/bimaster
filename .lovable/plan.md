

# Filtros por Marca, Linha e Produto na Revisão de Fichas

## Alterações

### 1. Atualizar query em `useFichaRevisao.ts`
Incluir `marca` e `linha` no select do join de produtos:
```
produto:fabrica_produtos(id, nome, codigo, origem, marca, linha)
```

### 2. Adicionar filtros na UI (`FichaRevisaoDiretoria.tsx`)
Na barra de filtros (linha 233), adicionar 3 selects ao lado da busca:
- **Marca** — lista única extraída dos produtos das fichas pendentes
- **Linha** — lista única extraída dos produtos, filtrada pela marca selecionada
- **Produto** — select com nomes dos produtos, filtrado por marca/linha

### 3. Atualizar lógica de filtragem
Alterar o `useMemo` de `fichasFiltradas` para aplicar os 3 novos filtros além da busca textual.

