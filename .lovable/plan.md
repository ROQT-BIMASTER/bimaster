## Objetivo

Executar uma regressão completa do módulo Projetos sem alterar código de produção, identificando falhas reais antes de propor correções. Testes feitos por análise estática + logs do backend, usando um projeto descartável para coletar evidências reais.

## Princípios

- **Read-only por padrão.** Só escrevo no banco através de um projeto isolado (`[QA] Regressão YYYY-MM-DD`) que será arquivado ao final.
- **Nada de mudança em código nesta etapa.** Se identificar bug, abro relatório com diagnóstico, hipótese e fix sugerido — você decide quando aplicar.
- **Cada finding terá:** local (arquivo:linha), evidência (log/SQL), severidade, sugestão.

## Fases

### Fase 1 — Mapa de risco (sem tocar em nada)
1. Listar todas as mutações do módulo: `useProjetoTarefas`, `useProjetos`, `useProjetoSecoes`, `useProjetoMembros`, `useProjetoAtividades`.
2. Cruzar com as mudanças recentes (virtualização, route prefetch, auto-save no detalhe, optimistic DnD, quick-add coluna, atalho C contextual).
3. Listar Edge Functions usadas por Projetos e RPCs (`add_team_member_safe`, `mover_tarefa_secao`, etc.).
4. Snapshot dos logs (Postgres / Edge / Auth) das últimas 24h filtrando `proj`, `tarefa`, `secao` para detectar erros já em produção.

### Fase 2 — Setup do projeto descartável
1. Criar projeto via UI real do app (registrado por SQL como evidência) com nome `[QA] Regressão {data}`.
2. Verificar invariantes pós-criação: dono = auth user, RLS, seções padrão criadas, registro em `projetos_atividades`.

### Fase 3 — Bateria funcional (cada item = pass/fail + evidência)

**Estrutura do projeto**
- Editar nome, descrição, cor de fundo (memo `usePageBgColor`).
- Adicionar/remover membros (RPC `add_team_member_safe`, validar bloqueio de duplicidade).
- Vincular produto.
- Definir prazo, meta, health.

**Seções**
- Criar via `NovaSecaoInline`.
- Renomear, reordenar, arquivar.
- Validar `ordem` contígua no banco.

**Tarefas — CRUD**
- Criar: inline, dialog, quick-add coluna (botão +), atalho `C` contextual, atalho `C` sem hover (deve cair na primeira coluna).
- Editar: título, descrição, responsáveis, prazo, prioridade, dependências, anexos.
- Auto-save no `ProjetoTarefaDetalhe` (debounce, evitar double-write).
- Excluir → conferir lixeira → restaurar.

**Views**
- Lista: ordenação, filtros, virtualização (`VirtualizedRows`) — checar com >50 tarefas se renderiza só janela visível.
- Kanban: drag entre colunas (cross-section), reordenação dentro da mesma coluna, otimismo (sem refetch piscante), cache atualizado, sem toast em sucesso, com toast em erro.
- Calendário, Cronograma, Inbox, Equipe, Briefing, Aprovações, Arquivos, Atividades.

**Tarefa detalhe**
- Comentários com mention.
- Subtarefas / dependências (bloqueios).
- Timeline e histórico de acesso.
- Tarefa espelho (badge).
- Focus mode.

**Permissões / RLS**
- Logar como usuário sem acesso e tentar abrir o projeto (deve cair em `ProjetoVisaoParcialBanner` ou bloqueio).
- Tentar mover tarefa de outro projeto (deve falhar).

**Integrações**
- Asana sync se ativo.
- Convites (`projetos/convites`).
- Documentação IA / Resumo IA / Criar Tarefas IA (chamadas Edge Functions).

### Fase 4 — Performance / mudanças recentes
- Sidebar prefetch: medir bundle dos chunks pré-carregados, garantir que erro silencioso não polui console.
- Route skeletons: confirmar que `Suspense fallback` aparece em rotas pesadas.
- Virtualização: comparar nº de DOM nodes em projeto com 100+ tarefas.
- Optimistic DnD: verificar ausência de race condition (drag rápido encadeado).

### Fase 5 — Limpeza
- Arquivar / mover para lixeira o projeto `[QA] Regressão {data}`.
- Confirmar que nenhuma referência cruzada ficou (atividades, anexos, espelhos).

## Entregável

Um relatório consolidado com:

```
Item                          | Status | Evidência                | Severidade | Fix sugerido
------------------------------|--------|--------------------------|------------|-------------
Criar tarefa via atalho C     | PASS   | log INSERT id=...        | -          | -
Optimistic DnD reorder rápido | FAIL   | refetch piscou em 300ms  | médio      | debounce 150ms em ProjetoKanbanView.tsx:142
...
```

Após você revisar o relatório, abrimos uma segunda fase em build mode aplicando só os fixes aprovados — um por vez para não arriscar produção.

## Detalhes técnicos

- Coleta de evidência: `supabase--read_query` + `supabase--analytics_query` para Postgres/Edge logs filtrados por timestamp da sessão de teste.
- Sem migrations, sem deploy de edge functions, sem alterações em tabelas.
- Browser automation só será usado se o item exigir interação que não se verifica por código/log (ex.: confirmar visualmente skeleton). Combinado com você: priorizar análise estática.
- Toda criação de dado será no projeto descartável; nenhum projeto existente é tocado.

## Fora de escopo

- Refactor de arquitetura.
- Novas features.
- Mudanças em RLS / migrations.
- Testes em módulos fora de Projetos (Fábrica, Finance, Trade, China).
