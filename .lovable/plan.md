

# Correções Finais para Chegar a 100/100

## Estado Atual: 82/100

A grande migração de RLS anterior corrigiu os problemas críticos. Restam **6 problemas** que impedem o 100%.

---

## Problemas Restantes

### 1. RLS: `projeto_briefings` — 6 policies com 2 duplicatas (SEGURANÇA)

Existem **2 DELETE duplicados** ("Users can delete briefings" + "Users can delete their briefings") e **2 INSERT duplicados** ("Users can insert briefings" + "Users can insert briefings to their projects"). A versão sem `user_can_access_projeto` permite INSERT sem verificar se o usuário é membro.

**Correção**: Dropar as 2 policies antigas; manter apenas as que usam `user_can_access_projeto` ou restringem a `criador_id`.

### 2. RLS: `projeto_briefing_campos` — restrito apenas ao criador (BUG FUNCIONAL)

As 3 policies (SELECT/INSERT/DELETE) verificam `p.criador_id = auth.uid()`. Membros coordenadores **não conseguem** ver nem editar campos de briefing.

**Correção**: Trocar para `user_can_access_projeto(auth.uid(), p.id)` + adicionar UPDATE policy.

### 3. RLS: `projeto_tarefa_messages` — só tem INSERT, falta SELECT/DELETE (BUG)

A tabela só tem 1 policy (INSERT com `auth.uid() = user_id`). Mensagens criadas **não podem ser lidas** por ninguém via RLS.

**Correção**: Adicionar SELECT (membros do projeto via tarefa), DELETE (autor pode deletar própria mensagem).

### 4. RLS: `projeto_tags` — linter warning `USING(true)` (LINTER)

Tags são globais, então SELECT com `true` é aceitável. Porém INSERT/UPDATE/DELETE usam `auth.uid() IS NOT NULL` (qualquer autenticado pode criar/deletar tags de qualquer projeto). Tags têm `projeto_id`, então devem ser restritas.

**Correção**: Substituir mutations por `user_can_access_projeto(auth.uid(), projeto_id)`.

### 5. Filtros não propagados para Kanban/Cronograma/Calendário (UX)

`ProjetoDetalhe.tsx` passa `filters` e `sort` apenas para `ProjetoListView`. As outras 3 views ignoram filtros.

**Correção**: Adicionar props `filters`/`sort` ao KanbanView, CronogramaView e CalendarioView; aplicar filtragem interna.

### 6. `projetos` INSERT com `auth.uid() IS NOT NULL` (BAIXO RISCO)

Qualquer autenticado pode criar projetos. Se isso é intencional (self-service), OK. Se só admins/coordenadores devem criar, restringir.

**Decisão**: Manter como está — criação de projetos é self-service.

---

## Plano de Execução

### Migration SQL

```text
1. DROP 2 policies duplicadas de projeto_briefings (INSERT e DELETE antigos)
2. DROP/CREATE 3+1 policies de projeto_briefing_campos (usar user_can_access_projeto + ADD UPDATE)
3. ADD 2 policies de projeto_tarefa_messages (SELECT + DELETE)
4. DROP/CREATE 3 policies de projeto_tags mutations (usar user_can_access_projeto)
```

### Código — Propagar filtros

| Arquivo | Alteração |
|---|---|
| `ProjetoKanbanView.tsx` | Aceitar props `filters`/`sort`, filtrar tarefas internamente |
| `ProjetoCronogramaView.tsx` | Aceitar props `filters`/`sort`, filtrar tarefas |
| `ProjetoCalendarioView.tsx` | Aceitar props `filters`/`sort`, filtrar tarefas |
| `ProjetoDetalhe.tsx` | Passar `filters={filters} sort={sort}` para as 3 views |

### Lógica de filtragem (reutilizada nas 3 views)

```text
- status: filtrar por status selecionados
- responsavel_id: filtrar por responsáveis selecionados  
- prioridade: filtrar por prioridades selecionadas
- secao_id: filtrar por seção
- search: filtrar por título (case-insensitive)
- sort: ordenar por campo/direção
```

## Resultado Esperado

- 0 policies duplicadas
- 0 linter warnings em tabelas de projetos
- Todas as tabelas com CRUD protegido por `user_can_access_projeto`
- Filtros funcionam em todas as views
- **Nota: 95-100/100**

