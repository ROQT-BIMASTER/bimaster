

# Kanban de Status de Produtos

## Conceito
Criar uma visão Kanban na tela de Produtos Acabados que agrupa automaticamente os produtos em 3 colunas baseadas no status da ficha de custos: **Sem Ficha**, **Em Revisão** e **Aprovado**. Cada card destaca a foto do produto em tamanho grande.

## Alterações

### 1. Criar `src/components/fabrica/ProdutoKanbanBoard.tsx`
- Componente read-only (sem drag-and-drop, pois o status é derivado da ficha de custos)
- 3 colunas com cores distintas:
  - **Sem Ficha** (cinza) - produtos sem registro em `fabrica_produto_custos_config`
  - **Em Revisão** (amarelo/laranja) - `status_aprovacao` = `revisao_solicitada` ou `em_revisao`
  - **Aprovado** (verde) - `status_aprovacao` = `aprovada`
- Cada card exibe: foto do produto (destaque grande usando `ProductThumbnail` size `xl`), nome, codigo, marca/linha, e custo total quando disponivel
- Clicar no card abre o `ProdutoDetalhesSheet` ou navega para a ficha de custos

### 2. Criar `src/components/fabrica/ProdutoKanbanCard.tsx`
- Card individual com foto em destaque (topo do card, largura total)
- Nome do produto, codigo, marca, badge de origem
- Custo total se disponivel

### 3. Editar `src/pages/FabricaProdutosAcabados.tsx`
- Adicionar toggle de visualizacao: Tabela | Grade | **Kanban** (ao lado dos botoes existentes de modo de visualizacao)
- Quando Kanban selecionado, renderizar `ProdutoKanbanBoard` passando os dados ja carregados (`produtos`, `fichasMap`, `custoTotalMap`)

### Arquivos
- **Criar**: `src/components/fabrica/ProdutoKanbanBoard.tsx`
- **Criar**: `src/components/fabrica/ProdutoKanbanCard.tsx`
- **Editar**: `src/pages/FabricaProdutosAcabados.tsx` (adicionar toggle e renderizacao condicional)

