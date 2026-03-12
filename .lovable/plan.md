

## Plano: Permitir Pré-Cadastro sem Projeto Vinculado

### Problema atual
Hoje, um `produtos_brasil` só é criado via vinculação a um projeto (`ProjetoVincularChina.tsx`), bloqueando a equipe de pré-cadastro.

### Alterações

**1. Botão "Novo Produto" na listagem**
- Em `ProdutosBrasilListagem.tsx`, adicionar botão "Novo Produto" que abre um dialog para criar um produto Brasil manualmente (informando dados China: nome, código, EAN, categoria, descrição)
- `projeto_id` será `null` — permitido pelo schema atual (já nullable)
- Status inicial: `aguardando_precadastro`

**2. Seletor de Projeto na tela de cadastro**
- Em `ProdutoBrasilCadastro.tsx`, adicionar um card/banner no topo quando `projeto_id` é `null`:
  - Alerta amarelo: "Este produto ainda não está vinculado a um Projeto"
  - Select para vincular a um projeto existente
- Quando projeto vinculado, o banner desaparece

**3. Validação de finalização**
- No `ChecklistRegulatorio.tsx`, os botões "Enviar para Regulatório" e "Aprovar Produto" verificam se `produto.projeto_id` existe
- Se `null`, exibir toast de erro: "Para finalizar o cadastro, este produto precisa estar vinculado a um Projeto."
- Bloquear transição para `aguardando_regulatorio` e `aprovado_cadastro` sem projeto

**4. Indicador visual na listagem**
- Em `ProdutosBrasilListagem.tsx`, mostrar um ícone/badge de alerta nos produtos sem `projeto_id`

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/pages/ProdutosBrasilListagem.tsx` | Botão "Novo Produto" + dialog de criação + indicador sem projeto |
| `src/pages/ProdutoBrasilCadastro.tsx` | Banner de vinculação de projeto no topo |
| `src/components/produto-brasil/ChecklistRegulatorio.tsx` | Validação de `projeto_id` antes de avançar status |
| `src/hooks/useProdutoBrasil.ts` | Ajustar `useCreateProdutoBrasil` para aceitar criação sem `projeto_id`/`submissao_china_id` |

Nenhuma alteração de schema necessária — `projeto_id` e `submissao_china_id` já são nullable.

