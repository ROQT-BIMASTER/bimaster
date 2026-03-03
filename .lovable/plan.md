

# Vincular Visualmente Unidade ao Kit na Listagem de Produtos

## Contexto
Na tabela de Produtos Acabados, produtos DISPLAY (Kits) e seus produtos-filhos (unidades) aparecem como linhas independentes, sem relação visual. O usuário quer que a unidade (ex: HB 573 Acabado) apareça visualmente "aninhada" abaixo do seu Display/Kit correspondente, como um sub-item indentado.

## Solução

### 1. Buscar relacionamentos Kit → Filhos
- Na query principal ou em query paralela, buscar `fabrica_produto_grade_itens` para montar um mapa: `Map<produto_filho_id, produto_pai_id>`.
- Isso permite saber quais produtos são filhos de quais Displays.

### 2. Reorganizar a lista para agrupar filhos sob seus pais
- No `useMemo` de `produtosFiltrados`, após filtrar, reordenar a lista para que produtos-filhos fiquem imediatamente após seu produto-pai (Display).
- Produtos que não são filhos de nenhum Display mantêm sua posição normal.
- Produtos que são filhos **e também aparecem independentemente** ficam duplicados apenas visualmente (aparecem na posição do pai como sub-item).

### 3. Renderizar sub-itens com indentação visual
- No `renderProdutoRow`, detectar se o produto é filho de um Display usando o mapa.
- Se for filho: aplicar indentação (`pl-8`), borda lateral azul (`border-l-2 border-l-blue-400`), fundo sutil (`bg-blue-50/30`), e um ícone de link (`Link2`) com label "↳ Kit: [código do pai]".
- O Display pai mantém seu estilo atual (borda primária, fundo `bg-primary/5`).

### 4. Mapa visual resultante

```text
┌─────────────────────────────────────────┐
│ 🟣 HB 573 DISPLAY    | Display (3 un.) │  ← bg-primary/5, borda primary
│   ↳ 🔗 HB 573        | Acabado         │  ← indentado, bg-blue-50/30, borda blue
├─────────────────────────────────────────┤
│    Outro produto      | Acabado         │  ← normal
└─────────────────────────────────────────┘
```

## Arquivos a Alterar

- **`src/pages/FabricaProdutosAcabados.tsx`**:
  - Nova query para `fabrica_produto_grade_itens` (buscar `produto_pai_id, produto_filho_id`).
  - `useMemo` para criar `Map<filho_id, pai_id>` e `Map<pai_id, filho_ids[]>`.
  - Reordenar `produtosFiltrados` para posicionar filhos após pais.
  - No `renderProdutoRow`: detectar filhos e aplicar indentação + estilo visual + badge de vínculo.

