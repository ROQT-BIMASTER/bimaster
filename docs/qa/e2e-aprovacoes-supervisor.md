# E2E — Fluxo Central de Aprovações (perfil Supervisor)

> Complementa `docs/qa/e2e-aprovacoes-flow.md`, focando no escopo
> hierárquico: um Supervisor deve ver itens de aprovação atribuídos a
> qualquer membro da sua equipe (todos os usuários cujo
> `profiles.supervisor_id` aponta para o supervisor logado, recursivamente).

## Contexto

- Hierarquia: `supervisor_id` é a única fonte de verdade
  (`mem://architecture/hierarchy-and-supervision-standards`).
- RLS de `aprovacao_kanban_items` permite ao supervisor ler os itens da
  cadeia descendente via semi-join (`EXISTS` em `profiles`).
- Componentes envolvidos:
  `src/pages/CentralAprovacoes.tsx` → `KanbanAprovacoes` →
  `ItemAprovacaoDrawer` → `HistoricoItemDialog` →
  hook `useComentarItem` (`src/hooks/useItemHistorico.ts`) →
  RPC `rpc_comentar_item_aprovacao`.

## Pré-requisitos

1. Usuário de teste com role `supervisor` (não admin) com pelo menos
   2 subordinados diretos em `profiles.supervisor_id`.
2. Cada subordinado deve ser responsável por ao menos 1 item de aprovação
   em status diferente (`em_analise`, `em_revisao`).
3. Filtro padrão da Central de Aprovações desligado em "Somente meus"
   para validar visibilidade de equipe.

## Roteiro

| # | Etapa | Resultado esperado |
|---|---|---|
| 1 | Logar no preview com a conta Supervisor | Redirect para `/dashboard`, sem 403. |
| 2 | Acessar `/dashboard/central/aprovacoes` | KPIs (Pendentes, Atrasadas) carregam contando itens da equipe inteira. |
| 3 | Conferir cards do Kanban | Aparecem cards de **mais de um responsável** (todos os subordinados); nenhum card de fora da hierarquia. |
| 4 | Aplicar filtro `Responsável → <subordinado A>` e em seguida `<subordinado B>` | Lista alterna corretamente; total dos dois filtros = total sem filtro. |
| 5 | Limpar filtros e clicar no card de um subordinado | `ItemAprovacaoDrawer` abre exibindo: nome do documento, breadcrumb (projeto › seção › tarefa), responsável (subordinado), etapa atual, ações disponíveis ao supervisor (Aprovar e avançar / Solicitar revisão / Rejeitar / Delegar). |
| 6 | Clicar em **Ver histórico do item** | `HistoricoItemDialog` abre, timeline exibe eventos anteriores (criação, movimentações). |
| 7 | Digitar `Teste e2e supervisor: validando visibilidade de equipe` no textarea e clicar **Comentar** | Toast `Comentário registrado no histórico.`; entrada nova aparece no topo da timeline com badge `Comentário`, autor = supervisor logado, timestamp atual. |
| 8 | Fechar dialog e drawer | Sem erros no console; KPIs continuam consistentes. |
| 9 | Validar persistência (refresh da página) | Comentário criado na etapa 7 continua presente no histórico. |

## Reproduzir via browser tool (Lovable agent)

```text
browser--navigate_to_sandbox path=/dashboard/central/aprovacoes
browser--screenshot                       # capturar KPIs + colunas
browser--observe instruction="List approval card responsáveis visible in the kanban"
# validar que há mais de 1 responsável distinto entre os cards
browser--act mode=structured method=click selector=<card de subordinado>
browser--act mode=natural_language action='Click "Ver histórico do item" button'
browser--act mode=natural_language action='Type "Teste e2e supervisor: validando visibilidade de equipe" into the comment textarea'
browser--act mode=natural_language action='Click "Comentar" button to submit'
browser--screenshot                       # confirmar nova entrada no topo
browser--navigate_to_sandbox path=/dashboard/central/aprovacoes
# reabrir mesmo card e histórico para validar persistência
```

## Validações negativas (não regredir)

- Supervisor **não** deve ver itens de usuários fora da sua subárvore
  (`supervisor_id` não aponta para ele direta ou recursivamente).
- Supervisor **não** deve conseguir comentar em item de outra equipe:
  RPC `rpc_comentar_item_aprovacao` retorna `permission denied`
  (validado por `public.test_rpc_comentar_item_aprovacao` —
  ver `docs/qa/test-rpc-comentar-item-aprovacao.md`).
- Filtro "Somente meus" deve esconder itens da equipe e mostrar apenas
  os itens em que o supervisor é responsável direto.

## Testes automatizados relacionados

- `src/hooks/itemHistorico/__tests__/useItemHistorico.test.tsx` —
  paginação infinita, filtros e invalidação de cache do `useComentarItem`.
- `src/components/projetos/aprovacoes/kanban/__tests__/HistoricoItemDialog.test.tsx`
  — flatten de `data.pages`, filtros de tab e busca.
- Migration `supabase/migrations/*_add_rpc_integration_test.sql` +
  `public.test_rpc_comentar_item_aprovacao(p_admin uuid)` — cobertura de
  permissão (criador, responsável, admin, não autorizado).

## Notas

- A visibilidade de equipe depende **exclusivamente** de
  `profiles.supervisor_id`. Não usar `gerente_id` (deprecado).
- Após comentar, `useComentarItem` faz `await Promise.all` em
  `invalidateQueries(["item-historico", itemId])` e
  `["item-aprovacao-auditoria", itemId]` com `refetchType: "all"` — a UI
  deve mostrar o evento sem precisar reabrir o dialog.
- Datas exibidas no histórico usam `parseLocalDate` + timezone
  `America/Sao_Paulo`. Não regredir para `new Date(string)`.
