# E2E — Fluxo Central de Aprovações

> Última execução manual via browser tool: 2026-05-04
> Ambiente: preview Lovable, usuário Leandro Moraes Ramos (admin).

## Cobertura

Este roteiro valida ponta-a-ponta o fluxo de Aprovações usado por
`/dashboard/central/aprovacoes` (`src/pages/CentralAprovacoes.tsx` →
`KanbanAprovacoes` → `ItemAprovacaoDrawer` → `HistoricoItemDialog`).

| # | Etapa | Componente / Hook | Resultado esperado |
|---|---|---|---|
| 1 | Navegar para `/dashboard/central/aprovacoes` | `CentralAprovacoes` | Página renderiza KPIs (Pendentes, Atrasadas) + colunas do Kanban (Em Análise, Em Revisão, ...). |
| 2 | Clicar em um card de aprovação | `KanbanAprovacoes` → `ItemAprovacaoDrawer` | Drawer lateral abre com nome do documento, breadcrumb (projeto › seção › tarefa), badges de etapa/status, responsável atual e ações (Aprovar e avançar / Solicitar revisão / Rejeitar). |
| 3 | Clicar em **Ver histórico do item** | `HistoricoItemDialog` + `useItemHistorico` | Dialog abre com tabs de filtro (Todos, Comentários, Movimentos, Delegações, Oficializações, Revogações, Prazos), busca, intervalo de datas e a timeline (ou `Nenhum evento para os filtros selecionados.`). |
| 4 | Digitar texto em **Adicionar comentário** e clicar **Comentar** | `useComentarItem` (RPC `rpc_comentar_item_aprovacao`) | Toast `Comentário registrado no histórico.` aparece, query `["item-historico", itemId]` é invalidada e o evento aparece imediatamente no topo da timeline com badge `Comentário` e timestamp. |
| 5 | Fechar dialog e drawer | — | Estado limpo, sem erros no console. |

## Como reproduzir manualmente

1. Logar no preview e ir para `/dashboard/central/aprovacoes`.
2. Aguardar carregar (skeletons → cards).
3. Clicar no primeiro card visível em **Em Análise**.
4. No drawer, clicar em **Ver histórico do item**.
5. Aplicar filtros (clicar **Comentários**, depois **Todos**).
6. Digitar `Teste e2e: comentário automatizado` no textarea.
7. Clicar **Comentar** e validar:
   - Toast verde de sucesso.
   - Nova entrada `Comentário` no topo da timeline com o texto digitado.
8. Fechar dialog (**Fechar**) e drawer (`X`).

## Reproduzir via browser tool (Lovable agent)

```text
browser--navigate_to_sandbox path=/dashboard/central/aprovacoes
browser--observe instruction="Find approval cards in the kanban"
browser--act mode=structured method=click selector=<primeiro card>
browser--act mode=natural_language action='Click "Ver histórico do item" button'
browser--act mode=natural_language action='Type "Teste e2e: comentário automatizado" into the comment textarea'
browser--act mode=natural_language action='Click "Comentar" button to submit'
browser--screenshot
```

## Testes unitários relacionados

- `src/hooks/itemHistorico/__tests__/useItemHistorico.test.tsx` — valida
  `useItemHistorico` (paginação infinita + filtros) e invalidação de cache em
  `useComentarItem`.

## Notas

- `HistoricoItemDialog.tsx` faz `data.pages.flat()` defensivo (corrigido em
  2026-05-04). Não regredir para `data.filter(...)` direto.
- RPC `rpc_comentar_item_aprovacao` usa `v_item.created_by` (corrigido em
  2026-05-04 — não usar `criado_por`).
