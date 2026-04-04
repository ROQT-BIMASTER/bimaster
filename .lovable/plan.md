

# Edição Interativa no Modo Foco do DRE

## Problema

Os dialogs de **Transferir Fornecedor** e **Editar Lançamento** já existem no componente `ContasPagarDREView`, mas:
1. Estão renderizados **dentro do `<Card>`**, causando conflito de z-index com o Dialog do Modo Foco
2. Não há indicadores visuais (ícones, tooltips) no Modo Foco para o usuário saber que pode clicar e editar
3. Falta um menu de contexto ou botões de ação visíveis nas linhas de fornecedor/lançamento

## Solução

### 1. Mover dialogs para o nível raiz do componente
Extrair `EditarClassificacaoRapidaDialog` e `TransferirFornecedorDialog` para fora do `<Card>` e do Dialog de foco, garantindo que fiquem sempre por cima (z-index correto via portal).

### 2. Adicionar ícones de ação nas linhas
- **Fornecedor**: Ícone de `ArrowRightLeft` (transferir) visível ao hover, com tooltip "Transferir fornecedor"
- **Lançamento**: Ícone de `Pencil` (editar) visível ao hover, com tooltip "Editar classificação"
- Aplicar classe `group` nas `<tr>` para ativar hover nos ícones filhos

### 3. Adicionar busca no Modo Foco
Input de busca no header do Modo Foco para filtrar fornecedores/contas pelo nome, facilitando localizar itens específicos entre centenas de linhas.

### 4. Adicionar filtro de busca com Combobox no TransferirFornecedorDialog
Substituir o `Select` de conta destino por um Combobox com busca (mesmo padrão já usado em `ClassificarContasEmLoteDialog`), pois são 200+ contas analíticas.

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `ContasPagarDREView.tsx` | Mover dialogs para raiz, adicionar ícones de ação com hover, adicionar input de busca no Modo Foco, classe `group` nas linhas |
| `TransferirFornecedorDialog.tsx` | Substituir Select por Combobox com busca para conta destino |

