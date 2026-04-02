

# Auditoria Completa do Modulo de Projetos — Nota: 68/100

## Resumo

Desde a ultima auditoria (72/100), foram corrigidas RLS de briefings/atividades/calendario e centralizado constantes. Porem, novas analises revelam **vulnerabilidades criticas de seguranca** nao identificadas anteriormente, reduzindo a nota para **68/100**.

## Pontuacao

| Categoria | Nota | Peso | Pontos |
|---|---|---|---|
| Funcionalidades | 85 | 25% | 21.25 |
| Performance | 65 | 20% | 13.0 |
| Seguranca/RLS | 45 | 20% | 9.0 |
| UX/Interface | 75 | 15% | 11.25 |
| Qualidade Codigo | 75 | 10% | 7.5 |
| Dados/Integridade | 65 | 10% | 6.5 |
| **TOTAL** | | | **68/100** |

---

## FALHAS CRITICAS DE SEGURANCA

### 1. BUG RLS: `projeto_membros` INSERT — qualquer usuario pode se adicionar como coordenador (GRAVIDADE: MAXIMA)

A policy "Coordinators manage members" tem um self-join bugado:
```sql
projeto_membros_1.projeto_id = projeto_membros_1.projeto_id
-- compara a coluna consigo mesma = SEMPRE TRUE
```
**Resultado**: Qualquer usuario autenticado pode INSERT em `projeto_membros` para qualquer projeto, se tornando coordenador e ganhando acesso total.

**Correcao**: Trocar para `projeto_membros_1.projeto_id = projeto_membros.projeto_id`.

### 2. BUG RLS: `projetos` UPDATE — join bugado (GRAVIDADE: ALTA)

A policy "Members can update projetos" tem:
```sql
pm.projeto_id = pm.id  -- compara projeto_id com o ID do membro = NUNCA TRUE
```
**Resultado**: Apenas criador e admin conseguem atualizar projetos. Membros coordenadores nao conseguem, o que e um bug funcional.

**Correcao**: Trocar para `pm.projeto_id = projetos.id`.

### 3. `projeto_tarefas` — DELETE/UPDATE/INSERT abertos a qualquer autenticado (GRAVIDADE: CRITICA)

```sql
DELETE: qual = (auth.uid() IS NOT NULL)
UPDATE: qual = (auth.uid() IS NOT NULL)
INSERT: with_check = (auth.uid() IS NOT NULL)
```
Qualquer usuario da plataforma pode criar, editar e deletar tarefas de qualquer projeto. O SELECT esta protegido por `user_can_access_secao`, mas as mutacoes estao completamente abertas.

**Correcao**: Restringir a `user_can_access_projeto(auth.uid(), projeto_id)`.

### 4. 13 tabelas auxiliares com policies permissivas `USING(true)` ou `IS NOT NULL`

Tabelas afetadas e o risco:

| Tabela | Operacoes abertas | Risco |
|---|---|---|
| `projeto_secoes` | INSERT/UPDATE/DELETE | Qualquer usuario cria/apaga secoes |
| `projeto_planos_acao` | ALL | Qualquer usuario gerencia planos |
| `projeto_tags` | ALL | Baixo (tags globais) |
| `projeto_tarefa_anexos` | SELECT | Leitura aberta de anexos |
| `projeto_tarefa_colaboradores` | SELECT/DELETE | Qualquer usuario remove colaboradores |
| `projeto_tarefa_comentarios` | SELECT | Leitura aberta de comentarios |
| `projeto_tarefa_metas` | SELECT/INSERT/UPDATE/DELETE | Qualquer usuario gerencia metas |
| `projeto_tarefa_metas_calendario` | ALL | Acesso total |
| `projeto_tarefa_movimentacoes` | SELECT/INSERT | Leitura e criacao abertas |
| `projeto_tarefa_produtos` | ALL | Qualquer usuario gerencia vinculos |
| `projeto_tarefa_tags` | ALL | Acesso total |
| `projeto_tarefa_validacoes` | ALL | Acesso total |
| `projeto_tarefa_documentos` | ALL (policy duplicada) | Conflito: tem policy restritiva E permissiva |

**Correcao**: Substituir todas por `user_can_access_projeto()` via tarefa_id join.

### 5. `projeto_tarefa_documentos` — policy duplicada conflitante

Tem uma policy `ALL` com `auth.uid() IS NOT NULL` **E** policies granulares com `user_can_access_secao`. A policy permissiva sobrepoe as restritivas (PostgreSQL e PERMISSIVE por padrao = OR).

**Correcao**: Dropar a policy "Authenticated users can manage task documents".

---

## MELHORIAS DE UX (Prioridade Media)

### 6. Filtros nao propagados para Kanban/Cronograma/Calendario

`ProjetoKanbanView`, `ProjetoCronogramaView` e `ProjetoCalendarioView` nao aceitam props `filters`/`sort`. O usuario aplica filtros e troca de aba — filtros desaparecem.

**Correcao**: Passar `filters` e `sort` como props do ProjetoDetalhe para todas as views.

### 7. Dados — 56% tarefas sem responsavel, 97% sem prazo

- 261/465 tarefas abertas sem `responsavel_id`
- 450/465 tarefas abertas sem `data_prazo`

Cronograma e Calendario ficam essencialmente vazios.

### 8. ArquivosView — race condition no filtro de secoes

A query `projeto-arquivos` nao depende de `allowedSecaoIds` no `queryKey`, entao pode retornar dados sem filtro se a query de permissoes ainda nao terminou.

**Correcao**: Adicionar `allowedSecaoIds` ao queryKey e `enabled` condition.

---

## O QUE MELHOROU DESDE A ULTIMA AUDITORIA

- RLS de `projeto_briefings`, `projeto_atividades`, `projeto_calendario_regras` corrigidas com `user_can_access_projeto()`
- Constantes centralizadas em `projetoConstants.ts`
- Metricas via RPC (resolve limite 1000 rows)
- teamMembers filtrado por projeto
- Visibilidade por secoes implementada nos hooks
- Tab "painel" corrigida

---

## PLANO DE CORRECAO (em ordem de prioridade)

### Migration SQL unica para corrigir todas as RLS:

1. **Corrigir bug self-join** em `projeto_membros` INSERT
2. **Corrigir bug join** em `projetos` UPDATE
3. **Restringir** `projeto_tarefas` DELETE/UPDATE/INSERT
4. **Restringir** `projeto_secoes` INSERT/UPDATE/DELETE
5. **Dropar** policy duplicada de `projeto_tarefa_documentos`
6. **Restringir** 10 tabelas auxiliares (substituir `true`/`IS NOT NULL` por `user_can_access_projeto`)

### Codigo:

7. **Corrigir race condition** no `ProjetoArquivosView` (queryKey + enabled)

### Arquivos a alterar

| Arquivo | Alteracao |
|---|---|
| Migration SQL | ~30 DROP/CREATE POLICY statements |
| `src/components/projetos/ProjetoArquivosView.tsx` | Adicionar `allowedSecaoIds` ao queryKey e enabled |

## Resultado esperado

- Nenhum usuario nao-membro consegue ler, criar ou modificar dados de projetos alheios
- Policies duplicadas eliminadas
- Race condition de visibilidade corrigida
- Nota estimada apos correcoes: **82/100**

