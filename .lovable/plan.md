# Cards por etapa em Pedidos em andamento — Result

## Objetivo

Adicionar, na tela `/dashboard/fornecedor/pedidos-result`, uma faixa de cards mostrando quantos pedidos existem em cada etapa do fluxo, logo abaixo dos filtros e acima das abas Kanban/Tabela.

## O que será exibido

Um card por etapa, na ordem do fluxo Result:

```text
Em digitação | Liberado (crédito) | Em separação | Conferido | Em expedição | Faturado | Entregue
```

Cada card mostra:
- nome da etapa
- quantidade de pedidos
- valor total dos pedidos daquela etapa
- destaque em vermelho com a quantidade de pedidos parados acima do limite de dias configurado (quando houver)
- barra/faixa colorida seguindo a cor já usada por aquela etapa no Kanban

Comportamento:
- Clicar em um card filtra a tela por aquela etapa (mesmo efeito do seletor "Etapa"); clicar de novo volta para "todas as etapas". O card ativo fica visualmente destacado.
- As contagens respeitam os filtros de período, filial, busca e "apenas parados" já aplicados, mas não o próprio filtro de etapa (assim os cards continuam servindo de navegação).
- Durante o carregamento aparecem placeholders; sem dados no período, os cards mostram zero.

## Detalhes técnicos

- Novo componente `src/components/fornecedor/pedidos/PedidosEtapaCards.tsx`: recebe a lista de pedidos (já filtrada, exceto etapa), `colunas` (`KANBAN_COLUNAS_RESULT`), `limiarParado`, `etapaAtiva` e `onEtapaClick`. Agrupa por `KanbanColuna.etapas`, soma `total_pedido` e conta `em_andamento && dias_na_etapa > limiarParado`.
- Cores reaproveitadas de `ETAPA_THEME`/`getEtapaTheme` em `etapaTheme.ts` (tokens semânticos, sem hex literal). Valores via `formatCurrency`.
- Em `src/pages/fornecedor/PedidosResultPage.tsx`: extrair um memo `pedidosSemEtapa` (filtros atuais sem o de etapa) para alimentar os cards, mantendo `pedidos` como está para Kanban/Tabela; renderizar `<PedidosEtapaCards />` entre `LeadTimeKpisCard` e a linha de "Filtros ativos". O clique reutiliza `setEtapaId`, preservando a persistência em `localStorage`.
- Layout responsivo em grid (2 colunas no celular, até 7 em telas grandes), sem alteração de dados ou backend.
