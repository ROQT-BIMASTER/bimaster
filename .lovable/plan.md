

## Plano: Módulo "Projetos" — Substituir o Asana com experiência superior

Baseado nas duas screenshots do Asana (visão de projeto com seções/tarefas e a Caixa de Entrada com feed de atividades), o plano cria um módulo completo que vai além do Asana integrando-se nativamente ao BiMaster.

---

### Funcionalidades que vão ALÉM do Asana

| Recurso | Asana | BiMaster (proposto) |
|---------|-------|---------------------|
| Caixa de Entrada | Feed básico de atividades | Feed inteligente com ações rápidas (aprovar, comentar, reagir inline) |
| Notificações | Email + in-app | Push nativo no celular + Realtime já existente |
| Aprovações | Workflow separado | Integrado ao ApprovalHub existente |
| Contexto de negócio | Genérico | Vincula tarefas a produtos, campanhas, lançamentos do sistema |
| IA | Básico | Resumo IA de projeto, sugestão de prazos, detecção de gargalos |
| Visão executiva | Portfólios pagos | Dashboard com progresso de todos os projetos em tempo real |

---

### Fase 1 — Implementação completa

#### 1. Banco de Dados (5 tabelas)

- **`projetos`** — id, nome, descricao, cor, icone, criador_id, status, visibilidade, created_at
- **`projeto_secoes`** — id, projeto_id, nome, ordem
- **`projeto_tarefas`** — id, projeto_id, secao_id, parent_tarefa_id (subtarefas), titulo, descricao, responsavel_id, status, prioridade, data_prazo, data_conclusao, codigo, ordem
- **`projeto_tarefa_colaboradores`** — tarefa_id, user_id (N:N)
- **`projeto_atividades`** — id, projeto_id, tarefa_id, user_id, tipo (criou_tarefa, completou, comentou, compartilhou, moveu), descricao, metadata jsonb, created_at

RLS: authenticated users com acesso ao projeto.

#### 2. Página de Projetos (`/dashboard/projetos`)

- Grid de cards de projetos com cor, ícone, progresso (barra), contagem de tarefas
- Botão "Novo Projeto" com modal (nome, cor, ícone, descrição)
- Filtros: Meus Projetos, Compartilhados, Todos
- Ao criar projeto, gera 4 seções padrão automaticamente

#### 3. Detalhe do Projeto (`/dashboard/projetos/:id`)

**Abas:** Lista | Quadro | Cronograma | Painel | Arquivos

**Visão Lista (principal, estilo Asana):**
- Seções colapsáveis com chevron e nome em bold
- Tarefas com checkbox circular, título, responsável (avatar), data prazo, colaboradores (avatar stack), status (badge colorido), prioridade
- Subtarefas indentadas (tarefas consolidadas) com expand/collapse
- "Adicionar tarefa..." inline no fim de cada seção
- "+ Adicionar seção" no final
- Toolbar: Filtrar, Ordenar, Agrupar, Densidade
- Datas vencidas em vermelho

**Visão Quadro:** Kanban por status com drag-and-drop (reutiliza padrão existente com @dnd-kit)

#### 4. Caixa de Entrada do Projeto (`/dashboard/projetos/inbox`)

Baseado na screenshot da "Caixa de entrada" do Asana, mas melhor:

- **Abas:** Atividade | @Menções | Arquivadas
- **Agrupamento temporal:** Hoje, Ontem, Últimos 7 dias, Mais antigos
- **Cards de atividade:** 
  - "Suas tarefas para hoje" com lista inline
  - "Novas tarefas adicionadas por [Nome]" no projeto X com lista
  - "[Nome] compartilhou este projeto com você"
  - "[Nome] completou a tarefa X"
- **Ações rápidas por card:** Curtir (👍), Comentar, Marcar como lida, Arquivar
- **Indicador de não lida** (bolinha azul à direita)
- **Filtro** e controle de **Densidade** (Compacto/Detalhado)
- Dados vêm da tabela `projeto_atividades` + `notifications` existente

#### 5. Sidebar e Navegação

- Novo grupo "Projetos" no AppSidebar com ícone Briefcase
  - Subitens: Caixa de Entrada, Meus Projetos, Todos os Projetos
- Badge com contagem de atividades não lidas

#### 6. Integração com sistema existente

- Responsáveis/colaboradores via `profiles`
- Push notifications via `send-notifications` edge function
- Log de atividades automático (trigger no banco ou chamada no frontend)

---

### Arquivos a criar

```text
src/pages/Projetos.tsx
src/pages/ProjetoDetalhe.tsx
src/pages/ProjetoInbox.tsx
src/components/projetos/ProjetoListView.tsx
src/components/projetos/ProjetoSecao.tsx
src/components/projetos/ProjetoTarefaRow.tsx
src/components/projetos/ProjetoSubtarefas.tsx
src/components/projetos/ProjetoKanbanView.tsx
src/components/projetos/ProjetoInboxFeed.tsx
src/components/projetos/ProjetoInboxCard.tsx
src/components/projetos/NovoProjetoDialog.tsx
src/components/projetos/NovaTarefaInline.tsx
src/components/projetos/NovaSecaoInline.tsx
src/components/projetos/ProjetoHeader.tsx
src/hooks/useProjetos.ts
src/hooks/useProjetoTarefas.ts
src/hooks/useProjetoAtividades.ts
```

### Arquivos a editar
- `src/App.tsx` — 3 novas rotas
- `src/components/dashboard/AppSidebar.tsx` — grupo Projetos

