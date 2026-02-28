

# Adicionar botão "Detalhes do Produto" no cabeçalho do chat

## O que será feito
Adicionar um botão no header do chat (ao lado do avatar do produto) que abre um painel lateral (Sheet) com os detalhes completos do produto vinculado à conversa, incluindo link rápido para a ficha de custos.

## Alterações

### 1. Criar componente `ProdutoDetalhesSheet.tsx`
- Sheet lateral que recebe o `produtoId` e carrega os dados do produto da tabela `fabrica_produtos`
- Exibe: foto, nome, código, marca, linha, origem, NCM, Anvisa, lead time, itens/display, status ativo/inativo, modo foco
- Carrega e exibe a última ficha de custos (custo total) via `fabrica_produto_custos_config`
- Lista as matérias-primas da fórmula ativa do produto
- Botão "Ver Ficha de Custos" que navega para `/dashboard/fabrica/produtos/{id}/custos`
- Botão "Editar Produto" que abre o `NovoProdutoAcabadoDialog` em modo edição

### 2. Integrar no `RevisaoChatConsolidado.tsx`
- Adicionar botão com ícone `Info` ou `ExternalLink` no header rico do chat (ao lado do nome do produto)
- Ao clicar, abre o `ProdutoDetalhesSheet` com os dados do produto da conversa selecionada

### Arquivos
- **Criar**: `src/components/fabrica/ProdutoDetalhesSheet.tsx`
- **Editar**: `src/components/fabrica/RevisaoChatConsolidado.tsx` (adicionar botão e importar o sheet)

