# Melhorias em Projetos — 14 solicitações dos usuários

Plano dividido em 4 fases, da mais rápida/de maior impacto para a mais estrutural. Nada altera dados existentes; todas as mudanças são aditivas.

## Situação atual verificada

- Duplicar existe apenas para **tarefa** (`ProjetoListView` → `handleDuplicarTarefa`). Não há duplicação de projeto nem de seção.
- Calendário do projeto e da Central mostram **somente tarefas** (prazo/início). Não existe entidade de "evento".
- A Central de Trabalho **já tem** modo Calendário agregando todos os projetos (`MinhasTarefasCalendar`), mas com pouca visibilidade e sem visão por setor/equipe.
- Menções (`MentionInput`) resolvem apenas usuários individuais; não há conceito de equipe/departamento mencionável.
- Reordenação manual existe só dentro da seção via RPC `reorder_tarefas_secao` (usado no quadro); a lista não expõe arrastar, e projetos/seções não têm reordenação manual.
- Pastas de projetos já têm escopo pessoal/compartilhada, mas o compartilhamento é por projeto — não há "compartilhar a pasta inteira com pessoas específicas".
- Prazos são exibidos em `dd/MM` em toda a UI (lista, widgets, cronograma, detalhe) — sem ano.
- A aba padrão ao abrir um projeto é `"quadro"` (`ProjetoDetalhe.tsx`, linha 97).
- "Mover para" no detalhe da tarefa está implementado nos 3 caminhos (projeto, Central, Minhas Tarefas) com patch otimista. O problema relatado precisa ser reproduzido antes de corrigir — a causa ainda não está confirmada.
- Copiloto e Manual do Projeto usam `FloatingActionSlot` fixo, sem opção de mover/recolher.

---

## Fase 1 — Ajustes rápidos de UX

1. **Modo Lista como padrão**: aba inicial passa a ser `lista`; a última aba escolhida por projeto fica memorizada por usuário (localStorage), então quem prefere quadro não perde a preferência.
2. **Ano no prazo**: prazo passa a mostrar `dd/MM/yy` quando a data não é do ano corrente (mantém `dd/MM` no ano atual para não poluir). Aplicado em lista, quadro, detalhe, cronograma e widgets da Central.
3. **Ordem alfabética**: adicionar "A → Z" e "Z → A" às opções de ordenação de projetos, seções e tarefas (`ProjetoFilterSort`), com a escolha persistida.
4. **Botões flutuantes**: o dock (Copiloto, Manual, Chat) ganha botão de recolher e passa a poder ser arrastado, com posição salva por usuário.

## Fase 2 — Ordenação manual e permissões

5. **Arrastar para reordenar na lista**: habilitar drag-and-drop de tarefas dentro e entre seções no modo Lista, reutilizando a RPC `reorder_tarefas_secao` já existente.
6. **Reordenar seções e projetos**: coluna `ordem` para seções (já existe) exposta por arrasto; para projetos, nova coluna de ordem manual por usuário, aplicada quando a ordenação escolhida for "Manual".
7. **Exclusão de tarefas por Coordenadores**: ampliar a regra de exclusão para incluir quem tem papel de coordenação/gestão no projeto, além do criador e do administrador. Alteração feita nas regras de acesso do banco + ajuste do menu para exibir a opção a quem realmente pode.

## Fase 3 — Sincronização e o bug de "Mover para"

8. **Investigar e corrigir "Mover para outra seção"**: reproduzir no ambiente real (projeto → detalhe da tarefa → Mover para), capturar a resposta do backend e o estado da lista. Suspeitas a checar em ordem: regra de acesso bloqueando a atualização silenciosamente, e a lista não sendo revalidada após o fechamento do painel. A correção só é definida após a reprodução.
9. **Atualizar sem F5**: revisar as invalidações de cache das ações de escrita (criar/editar/mover/excluir/atribuir) para que cada uma atualize a lista imediatamente, e ligar atualização em tempo real nas tabelas de tarefas e seções do projeto aberto.

## Fase 4 — Recursos novos

10. **Duplicar Projeto e Seção** (além de tarefa): diálogo com opções do que replicar — seções, tarefas, responsáveis, equipe, prazos (deslocados por uma data base), anexos. Implementado como operação única no backend para ser atômico e rápido.
11. **Eventos no calendário**: nova entidade de evento de projeto com título, data de início, data de fim, dia inteiro, responsáveis e cor. Criação por clique/arrasto no calendário, exibida junto às tarefas com estilo próprio, editável e excluível.
12. **Modo Calendário global**: promover o calendário da Central de Trabalho a visão de primeira classe com filtros por projeto, pessoa e equipe, permitindo ver as demandas do setor inteiro em um só lugar.
13. **Marcar equipe (@TI, @Regulatório)**: cadastro de equipes com membros; as menções passam a aceitar equipes, expandindo para todos os integrantes na notificação e mantendo o texto `@Equipe` na mensagem.
14. **Compartilhar pasta inteira**: compartilhamento de pasta com pessoas ou equipes, concedendo acesso a todos os projetos contidos (e aos que forem adicionados depois), com opção de somente leitura ou edição.

---

## Detalhes técnicos

- Frontend: `pages/ProjetoDetalhe.tsx`, `components/projetos/*` (`ProjetoListView`, `ProjetoSecao`, `ProjetoTarefaRow`, `ProjetoFilterSort`, `ProjetoCalendarioView`, `MentionInput`, `ProjetoPastas*`), `components/calendario/*`, `components/projetos/central/MinhasTarefasContent.tsx`, `hooks/useProjetoTarefas.ts`, `components/ui/floating-action-dock.tsx`.
- Drag-and-drop reutiliza `@dnd-kit` (padrão já usado em `ManualPrioritySortable`).
- Novas tabelas: `projeto_eventos`, `equipes` + `equipe_membros`, `projeto_pasta_compartilhamentos`, e coluna de ordem manual de projetos. Todas com regras de acesso e permissões explícitas.
- Duplicação via função de banco transacional (`rpc_duplicar_projeto`, `rpc_duplicar_secao`).
- Tempo real por projeto via canal único (padrão `uniqueChannelName`), com baixa em desmonte.
- Datas continuam via `parseLocalDate`/`formatLocalDate` (fuso São Paulo).
- Testes: unitários de formatação de data e ordenação, integração de reordenação e duplicação, e E2E do fluxo "mover para seção".
- Bump de `APP_VERSION` e entrada no changelog a cada fase entregue.
