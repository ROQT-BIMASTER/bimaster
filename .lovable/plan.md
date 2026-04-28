# Auditoria do Módulo de Projetos — Plano de Melhorias para Produção

## Estado atual (resumo)

- **Escala**: 25 projetos, 156 seções, 1.630 tarefas ativas, 62 membros, 34 tabelas `projeto_*`.
- **Cobertura**: 5 visões (Lista, Kanban, Cronograma, Calendário, Equipe), Inbox, Minhas Tarefas, Modelos, Briefings, Metas, Aprovações, Vínculo China, API externa (`projetos-api`), monitor de atrasos (cron), assistente IA.
- **Pontos fortes**: RLS em todas as tabelas, hierarquia de supervisor, padrões visuais consolidados, integração com China/Produtos, API documentada para Huggs.
- **Riscos identificados**: arquivos gigantes, ausência de paginação, RLS com policies redundantes, `projeto_atividades` vazia (audit log não populado), falta de índices em colunas-chave de filtro, ausência de testes automatizados nas regras de negócio críticas.

---

## 1. Performance e escalabilidade

**Problema**: `useProjetoTarefas` carrega tarefas sem paginação. Com 1.630 tarefas hoje e crescimento esperado, telas de Lista/Kanban/Cronograma vão degradar rapidamente.

**Ações**:
- Adicionar paginação server-side (cursor) e virtualização (react-window) na Lista quando >200 tarefas.
- Criar índices compostos:
  - `projeto_tarefas (projeto_id, excluida_em, ordem)`
  - `projeto_tarefas (responsavel_id, status) WHERE excluida_em IS NULL`
  - `projeto_tarefas (data_prazo) WHERE excluida_em IS NULL AND status <> 'concluida'`
  - `projeto_atividades (projeto_id, created_at DESC)`
- Trocar `select("*")` por colunas específicas nos hooks de listagem (reduz payload ~60%).
- Habilitar `staleTime` mais agressivo nas listas de projetos (10 min) — mudam pouco.

## 2. Audit log quebrado

**Problema**: Tabela `projeto_atividades` tem **0 registros**, mas o componente `ProjetoAtividadesLog` e `useProjetoAtividades` consomem dela. Trigger ausente ou desativado.

**Ações**:
- Criar trigger `AFTER INSERT/UPDATE/DELETE` em `projeto_tarefas`, `projeto_secoes`, `projeto_membros` que grava em `projeto_atividades` (autor, ação, payload diff).
- Backfill opcional de uma snapshot inicial para os 25 projetos existentes.
- Garantir RLS de leitura por membros do projeto.

## 3. Refatoração de arquivos gigantes

**Problema**: Manutenção difícil e re-render em cascata.
- `ProjetoTarefaDetalhe.tsx` — **1.289 linhas**
- `ProjetoCronogramaView.tsx` — 609 linhas
- `useProjetoTarefas.ts` — 598 linhas
- `ProjetoKanbanView.tsx` — 581 linhas

**Ações**:
- Quebrar `ProjetoTarefaDetalhe` em sub-componentes por seção (cabeçalho, prazos, responsáveis, anexos, China, Produto, comentários, dependências) — várias já existem em `tarefa-detalhe/`, falta finalizar.
- Extrair de `useProjetoTarefas` os hooks granulares: `useTarefaCRUD`, `useTarefaReorder`, `useTarefaBulkActions`.
- Memoizar células de Lista/Kanban (`React.memo` + comparação por id+updated_at).

## 4. Segurança RLS

**Problema**: Linter Supabase reporta múltiplos `SECURITY DEFINER` expostos a anônimos e 1 view com Security Definer. Algumas tabelas `projeto_*` têm policies redundantes (4 separadas onde 2 bastariam).

**Ações**:
- Revisar todas as funções `has_*projeto*` / `is_*projeto*`: revogar `EXECUTE` de `anon`, manter para `authenticated`.
- Consolidar policies de `projeto_tarefas`, `projeto_secoes`, `projetos` para reduzir cost de planner (semi-join `EXISTS` em vez de função SQL — alinhado com a memória "High Volume RLS").
- Auditar `projeto_tarefas_backfill_*` (1 policy só): garantir que são admin-only.
- Confirmar que `projetos-api` (Edge Function pública por API key) valida `secureHandler`, rate-limit e WAF.

## 5. Regras de negócio e governança

**Identificado**:
- Memória declara `data_prazo` e `inicio_planejado` obrigatórios — verificar enforcement no banco (CHECK/trigger), não só UI.
- `projeto_tipo` ('produto' vs 'generico') controla visibilidade de blocos China/Produto — falta validação server-side ao gravar `produto_vinculos` em projeto genérico.
- Tarefas "espelho" (`TarefaEspelhoBadge`) — verificar consistência de propagação de status.

**Ações**:
- Adicionar trigger validador: bloquear INSERT em `projeto_produto_vinculos` e `china_submissao_tarefa_vinculos` quando `projetos.tipo = 'generico'`.
- Trigger para impedir `UPDATE` removendo `data_prazo`/`inicio_planejado` quando já preenchidos.
- Job de consistência semanal (já há `projeto_tarefas_consistency_check_log`) — expor resultado em uma tela admin.

## 6. UX e produtividade

- **Bulk actions**: Lista não tem seleção múltipla para mover/atribuir/excluir em massa.
- **Filtros salvos**: cada usuário refaz filtros toda vez — adicionar "Visões salvas" por usuário.
- **Atalhos de teclado**: `ProjetoShortcutsDialog` existe — verificar se cobre criar tarefa, ir para inbox, busca global de tarefa (`/`).
- **Drag-and-drop**: padronizar em todas as visões (Lista, Kanban, Cronograma usam libs diferentes hoje).
- **Notificações**: falta integração de menções (`MentionInput`) com `notifications` para notificar usuário citado.

## 7. Observabilidade e qualidade

- Substituir os 8 `console.log/error` restantes por `logger.debug/error` (padrão do projeto).
- Adicionar testes unitários para `projetoFilterUtils` (já existe um) cobrindo: filtro por estágio, prazos vencidos, ordenação por prioridade.
- Adicionar teste E2E de fluxo crítico: criar projeto → adicionar seção → criar tarefa → mover para concluída → verificar atividade gerada.
- Métricas no monitor de atrasos: total de tarefas atrasadas por projeto/responsável, exposto em dashboard admin.

## 8. Integrações

- **API Huggs (`projetos-api`)**: documentação cobre CRUD básico, mas não expõe seções/tarefas. Avaliar se Huggs precisará disso. Rate-limit e logging de uso já presentes? Validar.
- **Asana sync** (memória existe): verificar se está ativo para projetos e respeita o protocolo de duas fases.
- **IA (`projeto-ia-assistant`)**: verificar consumo de tokens, fallback para Gemini Flash, e que respeita política `core-model-and-reasoning-policy`.

---

## Priorização sugerida (ordem de execução)

| # | Item | Impacto | Esforço |
|---|---|---|---|
| 1 | Trigger de `projeto_atividades` (audit log) | Alto | Baixo |
| 2 | Índices de performance em `projeto_tarefas` | Alto | Baixo |
| 3 | Paginação + virtualização da Lista | Alto | Médio |
| 4 | Revogar `EXECUTE` de funções SECURITY DEFINER para `anon` | Alto (segurança) | Baixo |
| 5 | Triggers de validação (tipo de projeto, prazos) | Médio | Baixo |
| 6 | Refatorar `ProjetoTarefaDetalhe.tsx` | Médio | Alto |
| 7 | Bulk actions e visões salvas | Médio | Médio |
| 8 | Notificações de menção | Médio | Médio |
| 9 | Testes E2E de fluxo crítico | Alto (qualidade) | Médio |
| 10 | Migrar `console.log` → `logger` | Baixo | Baixo |

---

## Próximo passo

Posso implementar este roadmap de forma incremental. Sugiro começar pelo **Bloco 1 (itens 1, 2, 4, 5)** — todas mudanças de banco de baixo risco e alto retorno, sem mexer em UI. Confirma se devo prosseguir por aí ou prefere outro ponto de partida.
