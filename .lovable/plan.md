

## Plano: Adicionar filtros por Categoria, Marca, Linha e Display na Visualização de Preços

### O que será feito

Adicionar uma barra de filtros entre a busca e a tabela no `VisualizacaoPrecosDialog.tsx`, com 4 selects:

1. **Categoria** — valores únicos extraídos dos produtos carregados
2. **Marca** — valores únicos extraídos dos produtos carregados
3. **Linha** — valores únicos extraídos dos produtos carregados
4. **Display** — filtro booleano (Todos / Apenas Displays / Excluir Displays), baseado no campo `tipo` do produto

### Como funciona

- Os valores dos selects serão extraídos dinamicamente dos dados já carregados (`precos`), sem queries adicionais
- Os filtros combinam com a busca textual existente (AND logic)
- A query de produtos já traz `categoria`, `marca`, `linha` — precisa adicionar `tipo` ao select
- Botão "Limpar filtros" para resetar todos de uma vez
- Layout: linha horizontal com 4 selects + botão limpar, estilo compacto

### Arquivo editado
- `src/components/fabrica/VisualizacaoPrecosDialog.tsx`
  - Adicionar `tipo` ao select de `fabrica_produtos` (linha 82-94)
  - Adicionar estados para os 4 filtros
  - Extrair valores únicos dos dados para popular os selects
  - Expandir `precosFiltrados` para incluir os novos filtros
  - Inserir UI dos filtros entre busca (linha 371) e tabela (linha 374)

