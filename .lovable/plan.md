## Diagnóstico — Módulo Projetos (Central + Detalhe + Subcentrais)

Auditei `src/pages/{Projetos,ProjetoDetalhe,ProjetoHome,ProjetoInbox,CentralTrabalho,Central*,MinhasTarefas,Tarefas}`, `src/components/projetos/**` (incluindo `central/` com 7 abas), `src/hooks/useProjeto*|useMinha*|useCentral*|useTarefa*` (22 hooks), 20 migrations recentes e o linter de banco.

### Forças

- Central de Trabalho com abas (Hoje, Tarefas, Delegadas, Inbox, Resumo) e preferências persistidas.
- Sistema de visibilidade endurecido (responsável + colaborador) com auditoria de acesso e debug admin.
- Telas de saúde/QA já existem (`ProjetosSaude`, `ProjetosVisualQA`, `DiagnosticoTarefasDataConclusao`).

### Gaps críticos para produção

**1. Segurança / Banco (713 alertas no linter)**
- 1 `SECURITY DEFINER VIEW` (ERROR) — view que ignora RLS do chamador.
- ~700 funções `SECURITY DEFINER` executáveis por anon/authenticated sem revogação explícita de EXECUTE.
- Pelo menos 1 `extension in public` e políticas RLS com `USING (true)` em UPDATE/DELETE/INSERT.

**2. Componentes monolíticos**
- `ProjetoTarefaDetalhe.tsx`: 1.303 linhas, 44 ocorrências de `any`/`as any`. Difícil de testar e regredir.
- `MinhasTarefasContent.tsx`: 747 linhas concentrando lista + filtros + toolbar + 4 visualizações.

**3. Observabilidade e qualidade de UX**
- Não há telemetria de erro client-side (Sentry/PostHog) nem captura de "Por que minha tarefa sumiu?".
- Estados vazios das abas (Hoje, Delegadas, Tarefas) não têm CTAs orientadores nem prints.
- Loading states inconsistentes (alguns spinners, outros skeletons).

**4. Performance**
- Algumas listas (`ProjetoListView`, Kanban) não virtualizam para projetos com 200+ tarefas.
- `useProjetoTarefas` busca tudo em uma única query sem paginação por seção.
- Falta `prefetchQuery` ao abrir tarefa (detalhe abre vazio antes de carregar).

**5. Acessibilidade**
- Botões só com ícone sem `aria-label` em vários pontos da Central e do detalhe.
- Diálogos sem `DialogTitle`/`DialogDescription` em alguns casos disparam warning do shadcn.
- `tabindex` e foco não gerenciados nas abas dinâmicas.

**6. Mobile**
- `ProjetoTarefaDetalhe` usa Sheet de largura fixa que quebra em < 640px.
- Toolbar da Central com muitos botões sem overflow-menu (cortes em telas pequenas).

**7. Operação / Onboarding**
- Não há tour/checklist no primeiro acesso (existe `ProjetoOnboardingCard` mas não está conectado).
- FAQ de visibilidade existe mas não está linkada nas telas-chave de gestão (Membros, Liberar Seção, Detalhe).

### Roadmap sugerido (4 ondas)

**Onda 1 — Endurecimento de segurança (bloqueante para produção)**
- Migration única corrigindo a view `SECURITY DEFINER` (converter para `security_invoker`).
- Auditar funções RPC realmente expostas: para cada uma, adicionar `REVOKE EXECUTE FROM anon` ou `REVOKE EXECUTE FROM PUBLIC` quando não devem ser chamáveis sem login.
- Eliminar políticas RLS com `USING (true)` em UPDATE/DELETE/INSERT (linter WARN 3).
- Mover extensões de `public` para o schema `extensions`.

**Onda 2 — Quebra de componentes monolíticos (qualidade de código)**
- Dividir `ProjetoTarefaDetalhe.tsx` em sub-seções (`TarefaCabecalho`, `TarefaCampos`, `TarefaSubtarefas`, `TarefaAcessoBlock`) — meta: arquivo principal < 400 linhas.
- Eliminar `as any` introduzindo tipos derivados de `Database` em `useProjetoTarefaDetalhe`.
- Extrair toolbar e filtros de `MinhasTarefasContent` para componentes dedicados (`MinhasTarefasToolbar`, `MinhasTarefasFilters`).

**Onda 3 — Performance e UX**
- Virtualização nas listas grandes (`react-virtuoso` ou `@tanstack/react-virtual`) na lista do projeto e no Kanban.
- `prefetchQuery` no `onMouseEnter` do row da tarefa para detalhe instantâneo.
- Skeletons consistentes (criar `<TarefaSkeleton/>`, `<KpiSkeleton/>` reutilizáveis).
- Empty states com ilustração + CTA por aba (Hoje, Tarefas, Delegadas, Inbox).
- Overflow menu na toolbar mobile da Central.

**Onda 4 — Operação, observabilidade e onboarding**
- Conectar `ProjetoOnboardingCard` ao primeiro acesso da Central (com flag em `central_preferences`).
- Linkar a FAQ de visibilidade (`/dashboard/ajuda/projetos-visibilidade`) a partir de: `ProjetoMembrosDialog`, banner de "Visão parcial", header das subcentrais.
- Adicionar telemetria de erro (Sentry) com tag `module=projetos`.
- Criar dashboard admin "Saúde da Central" agregando: tempo médio de carregamento, erros 5xx por RPC, % de tarefas órfãs, audit-trail de mudanças de acesso por dia.
- Renomear/depreciar `MinhasTarefas.tsx` (página standalone) consolidando tudo na Central.

### Não escopo desta análise

- Não incluí mudanças em China/Compras Internacionais nem nas centrais especializadas (Motor de Artes, Composição, Embalagens, Amostras) — cada uma merece auditoria própria.

### Como prosseguir

A análise acima é **diagnóstico + roadmap** (sem código). Quando aprovado, sugiro começar pela **Onda 1 (segurança)** como bloqueante e depois priorizar **Onda 2 (componentes)** — peça que eu detalhe e implemente onda por onda.
