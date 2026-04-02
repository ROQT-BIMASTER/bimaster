

# Auditoria Completa do Modulo de Projetos — Nota: 72/100

## Resumo Executivo

O modulo de Projetos e robusto em funcionalidades (8 visualizacoes, IA integrada, Asana sync, briefings, cofre documental), porem apresenta falhas de performance, seguranca e UX que impactam a operacao com 987 tarefas ativas e 40 membros.

---

## Pontuacao por Categoria

| Categoria | Nota | Peso | Pontos |
|---|---|---|---|
| Funcionalidades | 85/100 | 25% | 21.25 |
| Performance | 55/100 | 20% | 11.0 |
| Seguranca/RLS | 60/100 | 20% | 12.0 |
| UX/Interface | 75/100 | 15% | 11.25 |
| Qualidade de Codigo | 70/100 | 10% | 7.0 |
| Dados/Integridade | 65/100 | 10% | 6.5 |
| **TOTAL** | | | **72/100** |

---

## FALHAS CRITICAS (Prioridade Alta)

### 1. Performance — Waterfall de queries no useProjetoTarefas (Nota: 55)
O hook faz **7 queries sequenciais** em cascata: tarefas -> profiles -> colaboradores -> produtos -> linked_produtos -> movimentacoes -> team-members. Em projetos com 200+ tarefas, isso causa lentidao perceptivel.

**Correcao**: Paralelizar queries independentes com `Promise.all`, usar batch fetching.

### 2. Limite de 1000 registros nao tratado (Nota: 55)
O `useProjetos` busca **todas** as tarefas de **todos** os projetos para calcular metricas (`projetos-metrics`). Com 987 tarefas ativas, estamos no limite do Supabase (1000 rows). Quando ultrapassar, as metricas ficarao incorretas silenciosamente.

**Correcao**: Criar uma view materializada ou RPC no banco para calcular metricas por projeto.

### 3. Seguranca — Policies com `USING (true)` (Nota: 60)
- `projeto_briefings` tem SELECT com `USING (true)` — qualquer usuario autenticado ve todos os briefings
- `projeto_atividades` tem SELECT com `USING (true)` — qualquer usuario ve todas as atividades
- `projeto_calendario_regras` tem ALL com `auth.uid() IS NOT NULL` — qualquer usuario pode deletar regras de qualquer projeto

**Correcao**: Restringir policies a membros do projeto usando `user_can_access_projeto()`.

### 4. 56% das tarefas abertas sem responsavel (261/465)
Dado real do banco: 261 tarefas ativas nao tem `responsavel_id`. Isso compromete filtros de visibilidade, KPIs de equipe e produtividade.

**Correcao**: Alertar na UI quando tarefas nao tem responsavel; adicionar filtro rapido "Sem responsavel".

### 5. 97% das tarefas abertas sem prazo (450/465)
Apenas 15 tarefas abertas possuem data de prazo. O cronograma, calendario e alertas de atraso ficam essencialmente vazios.

**Correcao**: Dashboard de saude do projeto deveria alertar sobre isso; wizard de criacao deveria sugerir prazo.

---

## MELHORIAS RECOMENDADAS (Prioridade Media)

### 6. Duplicacao massiva de constantes
`STATUS_COLORS`, `STATUS_LABELS`, `ESTAGIO_COLORS` sao definidos em **5 arquivos diferentes** (KanbanView, TarefaRow, CronogramaView, CalendarioView, FilterSort). Qualquer alteracao precisa ser replicada em todos.

**Correcao**: Criar `src/lib/projetoConstants.ts` unificado.

### 7. ProjetoTarefaDetalhe tem 1477 linhas
Componente monolitico que gerencia abas (descricao, comentarios, anexos, briefing, cofre, timeline, dependencias, aprovacao, produtos). Dificil de manter.

**Correcao**: Extrair cada aba em componente separado.

### 8. Filtros e ordenacao so funcionam na visao Lista
Os filtros (`ProjetoFilterSort`) sao aplicados apenas em `ProjetoListView`. Kanban, Cronograma e Calendario ignoram os filtros selecionados.

**Correcao**: Passar `filters` e `sort` para todas as views.

### 9. Kanban sem persistencia de drag-and-drop
O KanbanView (526 linhas) implementa DnD com @dnd-kit, mas a reordenacao dentro de uma coluna nao persiste o campo `ordem` no banco.

**Correcao**: Chamar `updateTarefa` com nova `ordem` apos drop.

### 10. Tab "briefings" e "painel" renderizam o mesmo componente
No `ProjetoDetalhe.tsx`, ambos `activeTab === "briefings"` e `activeTab === "painel"` renderizam `ProjetoBriefingPanel`. Provavelmente um erro — "painel" deveria ser um dashboard de KPIs.

**Correcao**: Vincular a tab "painel" ao componente correto (ProjetoHealthPanel?).

### 11. teamMembers carrega TODOS os profiles
A query `team-members` no `useProjetoTarefas` busca **todos os profiles da plataforma** sem filtro por projeto ou departamento. Ineficiente e potencialmente expoe dados.

**Correcao**: Filtrar por `projeto_membros` do projeto atual.

### 12. Arquivos sem filtro de visibilidade por secao
O `ProjetoArquivosView` busca anexos de TODAS as tarefas do projeto, ignorando o filtro de secoes permitidas do membro.

**Correcao**: Aplicar filtro `allowedSecaoIds` nos arquivos tambem.

### 13. Exclusao de projeto sem confirmacao robusta
`deleteProjeto` faz `DELETE` direto sem verificar se tem tarefas ativas, membros ou dados vinculados. Pode causar perda de dados.

**Correcao**: Implementar soft delete com campo `excluido_em` ou dialog de confirmacao com resumo do impacto.

---

## MELHORIAS MENORES (Prioridade Baixa)

### 14. Sem paginacao na listagem de projetos
Com 5 projetos atuais nao e problema, mas nao escala.

### 15. Busca de projetos inexistente
A pagina `Projetos.tsx` nao tem campo de busca por nome.

### 16. Sem exportacao de dados do cronograma
Equipe Dashboard tem export Excel, mas Cronograma e Calendario nao.

### 17. Tour/onboarding define steps em imports separados
Boa pratica ja implementada com `TourButton`.

---

## O QUE ESTA BEM FEITO

- **Arquitetura de visibilidade por secoes** — Recentemente implementada e funcional
- **Soft delete de tarefas** com lixeira e restauracao
- **Audit trail automatico** via triggers no banco
- **Sistema de briefings** com aprovacao/rejeicao
- **Cofre documental** com versionamento
- **Integracao Asana** para sync bidirecional
- **IA integrada** para resumos e criacao de tarefas
- **Drag-and-drop** no Kanban com @dnd-kit
- **Colunas configuraveis** com persistencia em localStorage
- **Cronograma Gantt** com zoom por semana/mes/trimestre

---

## Proximos Passos Recomendados (Ordem de Prioridade)

1. Corrigir policies RLS permissivas (seguranca)
2. Resolver limite de 1000 rows nas metricas (data integrity)
3. Unificar constantes duplicadas (manutenibilidade)
4. Propagar filtros para Kanban/Cronograma/Calendario (UX)
5. Corrigir tab "painel" duplicada (bug)
6. Filtrar teamMembers por projeto (performance/seguranca)
7. Aplicar filtro de secoes nos Arquivos (seguranca)
8. Refatorar ProjetoTarefaDetalhe em componentes menores (manutenibilidade)

