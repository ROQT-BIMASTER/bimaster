

## Mover Aprovação para o Módulo Brasil

### Contexto

Hoje os botões "Aprovar / Rejeitar" submissões da China ficam na tela `ChinaFichaProduto.tsx`. O usuário quer que essa aprovação aconteça no módulo de **Produtos Importados** (Brasil), mantendo a tela da China apenas como visualização/envio de documentos.

### Plano

**1. Remover botões de aprovação da ChinaFichaProduto** (linhas ~329-353)
- Remover os botões "Aprovar 批准" e "Rejeitar 拒绝" da tela China
- Manter apenas o botão "Emitir OC" que já é exclusivo Brasil e faz sentido ali

**2. Adicionar painel de aprovação no `ProdutoBrasilCadastro`**
- Na tela de cadastro Brasil (que já tem a comparação lado a lado China vs Brasil), adicionar uma nova seção/card de **Aprovação da Submissão China**
- Mostrar resumo visual: status atual da submissão, progresso dos documentos (X de Y enviados, Z aprovados), dados do produto
- Botões "Aprovar Submissão" e "Rejeitar Submissão" com verificação de documentos obrigatórios
- Campo de observação obrigatório ao rejeitar (para a China saber o motivo)
- Esse card só aparece quando o produto Brasil está vinculado a uma submissão China (`china_submissao_id`)

**3. Lógica de aprovação**
- Reutilizar a mesma mutation `updateSubStatus` que já existe, chamando o update na tabela `china_produto_submissoes`
- Validar documentos obrigatórios antes de permitir aprovação
- Ao aprovar, avançar automaticamente o status do produto Brasil para a próxima etapa

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/ChinaFichaProduto.tsx` | Remover botões Aprovar/Rejeitar (linhas 329-353) |
| `src/pages/ProdutoBrasilCadastro.tsx` | Adicionar card de aprovação da submissão China |
| Novo: `src/components/produto-brasil/AprovacaoSubmissaoChina.tsx` | Componente com resumo + botões aprovar/rejeitar + campo de observação |

