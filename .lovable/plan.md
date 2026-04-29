
# Auditoria do Módulo de Projetos

Análise feita sobre `Projetos`, `ProjetoDetalhe`, `CentralTrabalho` (Hoje / Tarefas / Inbox), `ProjetoHome`, hooks (`useProjetoTarefas`, `useMinhasTarefas`, `useProjetos`) e componentes auxiliares (Header, Lista, Kanban, Cronograma, Calendário, Equipe, Briefings, Arquivos, Metas, Prazos).

O módulo está funcional e rico, mas apresenta gargalos arquiteturais e atritos de UX que se acumulam à medida que o volume de tarefas cresce. Abaixo, o diagnóstico e o plano de melhorias dividido em **falhas** (corrigir) e **melhorias de UX** (evoluir), com priorização.

---

## 1. Falhas funcionais detectadas

### 1.1 Visibilidade inconsistente de tarefas (alto impacto)
- A Central de Trabalho usa o RPC `get_minhas_tarefas_central` (correção recente para Nathalia), mas o `ProjetoDetalhe` ainda aplica filtragem **client-side dupla** em `useProjetoTarefas`: scope de seções + `restrictToOwn`. Resultado: a mesma tarefa pode aparecer na Central e sumir dentro do projeto, confundindo o usuário.
- `secoes` também são filtradas em memória após o fetch — uma seção sem tarefas atribuídas ao membro desaparece da lista, mesmo sendo dele a tarefa-pai.
- Não há um indicador visual quando o usuário está vendo uma "visão parcial" do projeto.

### 1.2 Performance / N+1 e fetch pesados
- `useProjetoTarefas` faz `select("*")` em `projeto_tarefas` e dispara **6 queries sequenciais** (profiles, colaboradores, produtos, links de produto, processos). Em projetos com 200+ tarefas, isso explode latência e payload.
- `useProjetos.ts` (449 linhas) replica o padrão para a lista geral.
- A criação por IA (`handleCreateIAItems`) usa `setTimeout(1500ms)` como sincronização entre criação de seções e tarefas — frágil e gera duplicatas quando o usuário cria muitas seções de uma vez.
- Não há virtualização: listas com 100+ tarefas renderizam todas, e cada `ProjetoTarefaRow` (907 linhas) é pesada.

### 1.3 Sem realtime no projeto
- Apenas `useProjetoTarefaDetalhe` escuta `postgres_changes`. Lista, Kanban, Cronograma e Central **não** recebem updates em tempo real — duas pessoas colaborando precisam recarregar para ver mudanças.

### 1.4 Mutations sem optimistic update
- `toggleTarefaCompleta`, `updateTarefa`, `createTarefa`, `moveTarefaToSecao` invalidam queries no `onSuccess`, gerando "piscada" e refetch completo. Apenas `addColaborador` usa `onMutate`. Em projetos grandes, marcar uma tarefa como concluída demora 1–2s visualmente.

### 1.5 Quadro Kanban / Cronograma / Calendário
- 581 / 609 / 426 linhas em um único componente cada — sem memoização das colunas, drag-and-drop reprocessa tudo.
- Cronograma não tem zoom (dia/semana/mês) consistente nem dependências visuais (apesar de existir `ProjetoTarefaDependencias`).
- Calendário não permite arrastar tarefa entre dias para reagendar.

### 1.6 Detalhe da tarefa monolítico (1289 linhas)
- `ProjetoTarefaDetalhe.tsx` concentra anexos, comentários, subtarefas, dependências, metas, espelho de processo, mentions. Difícil manter, propenso a bugs de re-render e bundle pesado.
- Abrir o dialog dispara várias queries mesmo quando algumas abas nunca são usadas naquela sessão.

### 1.7 Header e navegação
- 10 abas no `ProjetoHeader` (Lista, Quadro, Cronograma, Calendário, Prazos, Painel, Metas, Briefings, Equipe, Arquivos) em uma barra horizontal com scroll. Em telas médias o usuário precisa rolar para achar abas. "Painel" e "Equipe" usam o **mesmo componente** (`ProjetoEquipeDashboard`) — duplicidade confusa.
- "Aprovações" navega para fora do projeto sem breadcrumb de retorno consistente.
- Botões de ação (Membros, IA, Modelo, Lixeira) ficam como ícones sem rótulo e sem tooltip em alguns estados de cor escura.

### 1.8 Filtros e busca limitados
- `ProjetoFilterSort` filtra por responsável/prioridade/status/seção, mas não há filtro por **prazo** (ex.: vencendo nos próximos 7 dias), por **tag/etiqueta**, nem busca textual dentro do projeto.
- Filtros não persistem entre sessões nem na URL — abrir o link do projeto sempre volta ao "tudo".

### 1.9 Falta de estados vazios e de erro úteis
- Erros de RLS aparecem como "tela em branco" + redirect (`logProjectAccessDenied`). Nenhuma orientação ao usuário sobre como solicitar acesso.
- Quando o RPC `get_minhas_tarefas_central` falha, a Central mostra lista vazia silenciosa, sem CTA de "tentar novamente".

### 1.10 Outros riscos pontuais
- `localStorage` (`projetos:ver-todos`) não é limpo no logout — admin que faz `impersonate` herda a preferência.
- `bg_cor` do projeto é update direto no Supabase sem RLS check no client; OK pelo backend, mas falha silenciosa caso o usuário não seja membro.
- "Lixeira" não tem auto-purge nem aviso de retenção.
- Menção (@) em comentários não suporta navegação por teclado em todos os campos.
- O contador de "Sem datas" piscando agora é correto, mas **não há ação rápida** para definir a data inline a partir do badge — o usuário precisa abrir a tarefa.

---

## 2. Melhorias de UX recomendadas

### 2.1 Onboarding e orientação contextual
- Tour já existe — adicionar **estados pós-tour** para guiar o primeiro uso (criar 1ª seção, atribuir 1º responsável, definir 1º prazo).
- Empty states mais ricos com exemplos clicáveis ("Comece com um modelo de projeto").

### 2.2 Visão "Para mim" mais acionável
- No card "Sem datas planejadas", permitir **definir prazo inline** (popover de calendário direto no badge).
- Adicionar coluna de **carga de trabalho** ("você tem 12 tarefas para esta semana — 4 em conflito de horário").
- Agrupar por projeto colapsável dentro de "Hoje".

### 2.3 Bulk actions
- Já existe seleção múltipla em `MinhasTarefasContent` (checkbox lateral), mas não há barra de ações (mover, atribuir, mudar prazo em massa, concluir).

### 2.4 Visualizações ricas
- Cronograma: zoom dia/semana/mês, milestones de seção, dependências como linhas.
- Calendário: drag-and-drop para reagendar; código de cor por projeto/prioridade configurável.
- Kanban: WIP limits opcionais por coluna; agrupamento por responsável além de por status.
- Adicionar visão **"Workload"** (matriz responsável × semanas) acessível pela aba Equipe.

### 2.5 Colaboração
- Indicador "quem está vendo esta tarefa agora" (presence via Realtime).
- Comentários em tempo real com notificação no header.
- Reações rápidas em comentários (👍 ✅) já comum em ferramentas similares.

### 2.6 Atalhos de teclado expandidos
- `ProjetoShortcutsDialog` existe; falta:
  - `n` para nova tarefa na seção focada
  - `j/k` para navegar entre tarefas
  - `e` para abrir detalhe
  - `c` para concluir
  - `/` para focar busca

### 2.7 Personalização persistente
- Persistir filtros, ordenação e visualização preferida **por projeto** (não só global na Central).
- Permitir salvar "visões" nomeadas ("Sprint atual", "Atrasadas críticas").

### 2.8 Notificações
- Hoje só há contador na aba Inbox. Adicionar toasts contextuais: "Você foi atribuído a X", "Prazo de Y vence em 24h", "Z respondeu seu comentário". Push opcional via `usePushNotifications` (já existe no projeto).

### 2.9 Acessibilidade
- Várias abas e botões dependem só de ícone + cor. Adicionar `aria-label`, foco visível e contraste em modo `darkBg`.
- `animate-pulse` no badge "Sem datas" — respeitar `prefers-reduced-motion`.

### 2.10 Mobile
- `ProjetoHeader` quebra em telas <768px (10 abas roláveis + 4 ações no hero). Propor menu "Mais ▾" e bottom sheet para ações de tarefa.

---

## 3. Roadmap priorizado

### Fase 1 — Estabilidade e performance (1–2 sprints)
1. Migrar `useProjetoTarefas` para um RPC `get_projeto_tarefas_v2(projeto_id)` que devolve tudo em uma chamada (tarefas + colaboradores + produtos + processos), espelhando o padrão de `get_minhas_tarefas_central`.
2. Unificar regra de visibilidade em SQL: remover filtragem client-side de seções e `restrictToOwn`, expor via RPC quais seções/tarefas o usuário enxerga + um flag `is_partial_view`.
3. Adicionar `onMutate` (optimistic) em `toggleTarefaCompleta`, `updateTarefa`, `moveTarefaToSecao`, `createTarefa`.
4. Substituir `setTimeout(1500)` da criação por IA por `Promise.all` com IDs reais retornados.
5. Mostrar banner "Você está vendo apenas as tarefas/seções em que está envolvido" quando `restrictToOwn`/`is_partial_view` for verdadeiro.
6. Tratar erro do RPC da Central com retry + mensagem.

### Fase 2 — UX colaborativa (2–3 sprints)
7. Realtime na lista e Kanban via canal `projeto:{id}` (postgres_changes em `projeto_tarefas` + `projeto_secoes`).
8. Bulk actions na Central e na Lista (atribuir, prazo, status, mover).
9. Filtro por prazo + busca textual + persistência de filtros por projeto na URL e em `projeto_membro_preferences`.
10. Ação inline "definir datas" no badge "Sem datas".
11. Atalhos de teclado expandidos (j/k, n, e, c, /).
12. Unificar "Painel" e "Equipe" (uma aba só, com sub-tabs internas).

### Fase 3 — Visualizações ricas (3–4 sprints)
13. Refatorar `ProjetoTarefaDetalhe` em sub-componentes lazy por aba (anexos, comentários, dependências, espelho).
14. Cronograma com zoom + dependências; Calendário com drag-and-drop; visão Workload.
15. Visões salvas nomeadas + compartilháveis.
16. Presence em tempo real ("quem está vendo").
17. Mobile: header colapsável + bottom sheet.
18. Acessibilidade: aria-labels, contraste em darkBg, `prefers-reduced-motion`.

### Fase 4 — Polimento
19. Auto-purge da Lixeira (ex.: 30 dias) com aviso.
20. Limpeza de `localStorage` no logout/impersonate.
21. Push notifications de prazos críticos.
22. Templates de projeto enriquecidos (já existe `SalvarComoModeloDialog` — melhorar galeria).

---

## 4. Detalhes técnicos (para a equipe de implementação)

- **RPC unificado**: `get_projeto_tarefas_v2(p_projeto_id uuid)` retornando JSON com `tarefas[]`, `secoes[]`, `is_partial_view boolean`, `allowed_secao_ids uuid[]` — `SECURITY DEFINER`, mesmo padrão de `get_minhas_tarefas_central`.
- **Optimistic updates**: usar `queryClient.setQueryData(["projeto-tarefas", projetoId], (old) => ...)` em `onMutate`, com rollback em `onError`.
- **Realtime**: assinatura única por projeto em `useProjetoTarefas`, invalidando a query ao receber evento.
- **Virtualização**: `@tanstack/react-virtual` para Lista/Kanban com >50 itens.
- **Lazy detalhe**: `React.lazy` para abas pesadas do `ProjetoTarefaDetalhe`.
- **Busca**: índice trigram em `projeto_tarefas.titulo` + RPC `search_projeto_tarefas`.
- **Filtros persistidos**: nova tabela `projeto_membro_view_state(projeto_id, user_id, filters jsonb, sort jsonb, view text)` com RLS por `auth.uid()`.

---

## 5. Próximo passo sugerido

Recomendo começar pela **Fase 1** — ela elimina o root cause das queixas recentes (visibilidade + lentidão) e prepara o terreno para o resto. Posso seguir implementando essa fase, ou ajustar prioridades conforme o que for mais crítico para o seu time agora. Me avise:

1. Atacar Fase 1 completa (RPC unificado + optimistic + banner de visão parcial)?
2. Priorizar **realtime** (Fase 2 item 7) primeiro porque é o que mais afeta colaboração?
3. Ou **bulk actions + filtros persistidos** porque é o atrito diário maior?
