
## Filtros e Agrupamento Hierarquico na tela de Produtos Acabados

### O que sera feito

Adicionar na pagina de Produtos Acabados os mesmos filtros que existem na Matriz Comparativa de Precos, com agrupamento hierarquico por Marca e Linha.

### Mudancas

**Arquivo: `src/pages/FabricaProdutosAcabados.tsx`**

1. **Novos filtros** (seguindo o mesmo padrao visual da Matriz):
   - Filtro por **Marca** (Select com todas as marcas distintas dos produtos)
   - Filtro por **Linha** (Select com todas as linhas distintas dos produtos)
   - Botao "Limpar" filtros quando algum filtro estiver ativo

2. **Agrupamento hierarquico**:
   - Toggle (Switch) para habilitar/desabilitar agrupamento
   - Select para escolher agrupar por "Marca" ou "Linha"
   - Quando ativo, a tabela sera dividida em secoes com cabecalho de grupo (ex: "MELU" como marca, e dentro dela os produtos da marca)
   - Cada grupo tera um cabecalho visual destacado com o nome do grupo e contagem de itens

3. **Barra de filtros**: Os filtros serao colocados entre os KPIs e a tabela, dentro de um container `bg-muted/30 rounded-lg border` com icone de Filter, igual ao da Matriz.

### Detalhes tecnicos

- Extrair marcas e linhas unicas com `useMemo` a partir dos dados de `produtos`
- Aplicar filtros `filtroMarca` e `filtroLinha` sobre `produtosFiltrados`
- Implementar `dadosAgrupados` com `useMemo` que agrupa os produtos filtrados por marca ou linha (Map de chave para array de produtos)
- Renderizar grupos com `TableRow` de cabecalho spanning todas as colunas, seguido dos produtos do grupo
- Importar `Switch`, `Label`, `Filter`, `Layers`, `X` dos componentes existentes
- Manter a busca textual existente integrada na nova barra de filtros
