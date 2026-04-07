
# Ocultar/Exibir Produtos na Tela de Produtos Acabados

## Abordagem

Adicionar um campo `oculto` (boolean) na tabela `fabrica_produtos` para que o usuário possa marcar produtos como ocultos. Na tela, um toggle permitirá mostrar/esconder os produtos ocultos. Por padrão, produtos ocultos ficam invisíveis.

## Alterações

### 1. Migration SQL
- Adicionar coluna `oculto boolean default false` na tabela `fabrica_produtos`

### 2. `src/pages/FabricaProdutosAcabados.tsx`
- Adicionar estado `mostrarOcultos` (default `false`) com um toggle na barra de filtros (ícone Eye/EyeOff + label "Mostrar ocultos")
- No filtro `produtosFiltrados`, excluir produtos com `oculto = true` quando `mostrarOcultos` estiver desligado
- Na coluna "Ações" de cada linha da tabela, adicionar botão para ocultar/desocultar o produto (ícone EyeOff/Eye)
- Produtos ocultos, quando visíveis, terão opacidade reduzida para diferenciação visual
- Exibir badge no toggle indicando quantos produtos estão ocultos

### 3. Lógica de toggle do produto
- Ao clicar no botão ocultar/desocultar, fazer `update` no campo `oculto` da `fabrica_produtos` e invalidar o cache

## Impacto
- Não afeta permissões nem RLS
- Simples e reversível — o produto nunca é excluído, apenas marcado
