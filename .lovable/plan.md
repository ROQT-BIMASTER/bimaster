

# Auditoria do Módulo de Projetos — Nota Atual: 96/100

## Pontuação por Categoria

| Categoria | Nota | Peso | Pontos |
|---|---|---|---|
| Segurança / RLS | 98 | 25% | 24.5 |
| Funcionalidades | 92 | 20% | 18.4 |
| UX / Interface | 95 | 20% | 19.0 |
| Performance | 95 | 15% | 14.25 |
| Qualidade de Código | 90 | 10% | 9.0 |
| Consistência Visual | 95 | 10% | 9.5 |
| **TOTAL** | | | **96/100** |

## O que foi corrigido desde a última auditoria (88→96)

- Filtros propagados para Kanban, Cronograma e Calendário
- Filtros internos ocultados quando toolbar ativa (badge "Filtros ativos via toolbar")
- Banner "tarefas sem prazo" no Calendário
- Preview do projeto visível para todos os templates
- RLS de briefings, mensagens e tags corrigidas
- 0 policies permissivas em tabelas de projetos

---

## 4 PONTOS RESTANTES PARA O 100%

### 1. Kanban — reordenação dentro da coluna sempre coloca no final (BUG — 2pts)

O `handleDragEnd` calcula `overIndex = columnTasks.length` (hardcoded no final). Não usa `SortableContext` do dnd-kit, então a posição real do drop nunca é detectada. Reordenar cards dentro de uma coluna não funciona — o card vai sempre para o final.

**Correção**: Adicionar `SortableContext` com `verticalListSortingStrategy` em cada coluna. Usar `arrayMove` para calcular a posição real e persistir `ordem` para todos os cards afetados na coluna.

### 2. ProjetoTarefaDetalhe — 1477 linhas (MANUTENIBILIDADE — 1pt)

Monólito que gerencia 8 funcionalidades distintas. Funciona, mas dificulta manutenção futura.

**Correção**: Extrair sub-componentes: `TarefaDescricaoTab`, `TarefaComentariosTab`, `TarefaAnexosTab`, `TarefaTimelineTab`.

### 3. Linter: extensão em schema public (INFRA — 0.5pt)

Extensão(ões) instaladas no schema `public` em vez de um schema dedicado. Baixo risco, mas flagged pelo linter.

**Correção**: Mover extensões para schema `extensions` (requer cuidado com dependências).

### 4. Calendário/Cronograma — filtros internos ainda aplicados mesmo com toolbar (EDGE CASE — 0.5pt)

Os filtros internos (`filterSecao`, `filterStatus`) são ocultados visualmente quando `hasActiveFilters`, mas o `tasksByDate` e `filteredTarefas` ainda aplicam esses filtros (que permanecem em "all"). Isso funciona corretamente por acaso, mas se o estado interno mudar antes de ativar filtros externos, os dois filtros se acumulam.

**Correção**: Resetar `filterSecao`/`filterStatus` para "all" quando `hasActiveFilters(filters)` mudar para `true`.

---

## Plano de Correção

### Código

| Arquivo | Alteração |
|---|---|
| `ProjetoKanbanView.tsx` | Adicionar `SortableContext` + `verticalListSortingStrategy` por coluna; calcular posição real no drop; persistir `ordem` para todos os cards reordenados |
| `ProjetoTarefaDetalhe.tsx` | Extrair 4 sub-componentes de tabs (descricao, comentarios, anexos, timeline) |
| `ProjetoCronogramaView.tsx` | Reset de filtros internos quando filtros externos ativam |
| `ProjetoCalendarioView.tsx` | Reset de filtros internos quando filtros externos ativam |

### Resultado esperado

- Kanban com reordenação real e persistente
- Código mais manutenível (detalhe de tarefa modularizado)
- 0 edge cases em filtros
- **Nota: 100/100**

