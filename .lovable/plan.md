# Tornar status "Em Revisão" sempre visível em Produtos Acabados

## Diagnóstico

Verifiquei no banco que o produto **HB-C7100/1-8 (PROVADOR)** existe em `fabrica_produtos` com `config.status_aprovacao = "em_revisao"` e `revisao_ativa_id` apontando para a revisão pendente. Ou seja, **o produto não está sumindo do banco** — ele aparece na listagem com a coluna "Ficha" exibindo o badge `StatusAprovacaoBadge`.

A queixa do usuário é de **visibilidade**: hoje o status fica em uma coluna no meio da tabela e é fácil não notar. Em Comunicação/Revisão de Fichas o produto aparece em destaque, mas em Produtos Acabados ele se "esconde" entre os demais. Em telas largas (2396px) o usuário precisa caçar a coluna.

Não há bug de filtro escondendo a linha — confirmei que `produtosFiltrados` não filtra por `status_aprovacao`. O `fichasMap` é populado corretamente e a row recebe `bg-red-50` quando em revisão. Mesmo assim falta destaque global.

## Plano de implementação

### 1) Novo KPI clicável "Em Revisão"

Em `src/pages/FabricaProdutosAcabados.tsx`, adicionar um 7º card de KPI:

- Conta `produtos.filter(p => fichasMap.get(p.id) === "em_revisao" || fichasMap.get(p.id) === "revisao_solicitada").length`.
- Cor âmbar (mesma família do StatusAprovacaoBadge `em_revisao`).
- Ícone `Clock` à direita.
- Clique alterna `filtroStatusFicha` entre `"em_revisao"` e `"none"` (atalho rápido para isolar os pendentes).
- Texto secundário: link "Ver na Comunicação de Revisões →" levando para `/dashboard/fabrica/comunicacao-revisoes`.

### 2) Filtro por status de ficha na sidebar

Adicionar novo `Select` "Status da Ficha" na sidebar de filtros, com opções:
- Todos (none)
- Sem Ficha
- Rascunho
- Em Revisão
- Revisão Solicitada
- Aprovada

Aplicar no `produtosFiltrados` via `fichasMap.get(p.id)`.

### 3) Reforço visual nas linhas em revisão (tabela)

- Adicionar borda lateral âmbar (`border-l-4 border-l-amber-500`) à `<TableRow>` quando `isEmRevisao`.
- Mover a coluna "Ficha" para logo após "Nome" (mais à esquerda) — assim fica visível sem rolagem horizontal.
- Trocar o destaque atual `bg-red-50` por `bg-amber-50/40 dark:bg-amber-950/20` (alinhar com o badge).

### 4) Reforço visual nos cards (`ProdutoCard`)

- Quando `statusFicha` for `em_revisao` ou `revisao_solicitada`, aplicar `ring-2 ring-amber-500/40` no card.
- Garantir que o `StatusAprovacaoBadge` apareça no canto superior direito (já existe — só conferir z-index/overflow).

### 5) Banner agregado no topo da listagem

Quando `count(em_revisao) + count(revisao_solicitada) > 0`, exibir um `Alert` âmbar acima da tabela:

> "**N produto(s) em revisão.** Clique aqui para filtrar a lista, ou abra Comunicação de Revisões para acompanhar o parecer."

Com dois botões: "Filtrar lista" e "Abrir Revisões".

### 6) Garantir rendering robusto

- O `useSupabaseQuery(["fabrica-produtos-fichas-config"])` já usa `staleTime: 0, refetchOnMount: "always"`. Reforçar invalidação após salvar/submeter a ficha (já feito na correção anterior em `useFichaRevisao.ts`) — apenas validar.
- Se `fichasConfig` ainda está carregando, mostrar skeleton no badge da coluna "Ficha" em vez de "Sem Ficha" (evita falso "Sem Ficha" piscando).

## Arquivos a editar

- `src/pages/FabricaProdutosAcabados.tsx` — KPI, filtro, alerta agregado, ordem de colunas, destaque visual.
- `src/components/fabrica/ProdutoCard.tsx` — `ring` âmbar quando em revisão.

## Resultado esperado

- O produto **NUNCA** desaparece da listagem por estar em revisão.
- O usuário vê de imediato, no topo da tela, quantos produtos estão pendentes de aprovação.
- Um clique no KPI ou no Alert isola exatamente esses produtos.
- A coluna de status fica em posição privilegiada (após o Nome) com borda lateral âmbar destacando a linha.
- A informação "Em Revisão" passa a ser consistente entre **Produtos Acabados** e **Comunicação de Revisões de Fichas**.
