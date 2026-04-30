## Diagnóstico real

Os logs do `asana-sync` mostram a causa exata da falha (não é schema):

```
[time] Budget low, stopping tasks at 30/1648
[time] Budget low, stopping tasks at 41/1648
[core] Done (complete=false): 1 projects, 9 sections, 33 tasks, 45 collaborators
```

A função processa apenas **30–41 tarefas por execução** (de **1648 totais**), salva como `core_partial` e o frontend deveria chamar de novo. O hook tenta retomar, mas:

1. **Não há cursor/offset persistido**: a cada chamada, a função busca **as mesmas 1648 tarefas** do Asana (`/projects/{gid}/tasks`), itera do índice 0, e o upsert por `asana_gid` "pula" as já existentes — porém **continua gastando ~1s por tarefa em UPDATE** (o `existingTaskMap.get` evita o INSERT mas o UPDATE roda em todas). Resultado: nunca passa do mesmo ponto.
2. **Sem paginação no Asana**: usa `asanaGetAll` que segue todos os `next_page` antes de começar a gravar — com 1648 tarefas, gasta boa parte do orçamento só baixando.
3. **Custom fields 'Prioridade' duplicados**: o código pega o primeiro `cf.name === "prioridade"` que aparece, e às vezes esse vem com `display_value` nulo (campo herdado de outro projeto sem valor). A análise do usuário está correta nesse ponto — precisa filtrar por valor não nulo.
4. **Trim ausente** em `cfMap` quando se usa em status/estágio (já há `.toLowerCase().trim()` na chave, mas o **valor** preserva `"Média "`).
5. **Frontend não mostra "Origem Asana"** apesar do `asana_gid` existir.

## Escopo do plano

Foco: fazer a sincronização **terminar** sem perder dados, normalizando os duplicados. Sem alterações de schema invasivas (a maioria dos campos sugeridos pelo relatório do usuário já existe: `asana_gid`, `parent_tarefa_id`, `projeto_tarefa_colaboradores`, `campos_customizados` jsonb).

### 1. Edge Function `asana-sync` — retomada eficiente

- **Adicionar cursor por projeto** na tabela `asana_sync_log` (campo novo `cursor jsonb`): `{ project_gid, last_task_index, phase }`. Persistido a cada lote.
- **Paginar do Asana com `limit=100` + `offset`** em vez de `asanaGetAll`. Processar página a página, salvando o `next_page.offset` no cursor.
- **Pular tarefas já com hash idêntico**: comparar `asana_json_raw->>'modified_at'` antes de fazer UPDATE. Se igual, `continue`. Isso reduz drasticamente o trabalho em retomadas.
- **Aumentar `TIME_BUDGET_MS` para 55s** (limite real do edge é 60s) e baixar threshold de corte para 4s.
- **Pular fase 2 nas retomadas de fase 1**: só entrar em "secondary" quando `core` realmente terminar (`cursor = null`).

### 2. Normalização correta dos custom fields

- Ao construir `cfMap`, **agregar todos os campos com mesmo nome** e ficar com o que tem `display_value` ou `enum_value` não nulo:
  ```ts
  const key = cf.name.toLowerCase().trim();
  const val = (cf.enum_value?.name || cf.display_value || "").trim();
  if (val && !cfMap.has(key)) cfMap.set(key, val); // primeiro com valor vence
  // se já existe mas vazio, sobrescreve
  ```
- Aplicar `.trim()` no valor (não só na chave).
- Preservar `camposCustomizados` jsonb com **todos** os valores brutos (já faz), mas adicionar `_normalized: { prioridade, status, estagio }` para auditoria.

### 3. Frontend — badge de origem Asana

- Em `ProjetoTarefaRow.tsx` e cards do Kanban, adicionar pequeno ícone Asana (16px) ao lado do título quando `asana_gid != null`. Tooltip: "Importada do Asana — GID: {gid}".
- Nenhuma alteração de UX maior; é puramente visual e não toca lógica de negócio.

### 4. UI da página `AsanaIntegracao`

- Mostrar progresso real: "Processando tarefa 230/1648 (projeto X)" lendo `cursor` do log via polling em vez de só `tasks_synced` cumulativo.
- Botão "Retomar última sync" que reusa `log_id` parcial em vez de criar log novo.

## O que NÃO vou fazer (já está OK ou fora de escopo)

- Não vou criar tabelas novas (`projeto_tarefa_seguidores` já existe como `projeto_tarefa_colaboradores`; `parent_tarefa_id` já existe; `campos_customizados` jsonb já guarda tudo).
- Não vou mexer em `canal_criacao` agora — o JSON `campos_customizados` já preserva o valor; podemos extrair em coluna dedicada num passo seguinte se você quiser filtros.
- Não vou baixar anexos para storage — fica como link externo (já é o comportamento atual).

## Resumo técnico

```text
asana_sync_log
  + cursor jsonb            -- { project_gid, offset, page_offset_token }

asana-sync/index.ts
  - asanaGetAll() para tarefas
  + asanaGetPage(offset, limit=100)
  + skip-if-unchanged via modified_at
  + retoma de cursor.last_task_index
  + TIME_BUDGET_MS = 55000

useAsanaSync.ts
  + lê log.cursor para mostrar X/Y real
  + retoma com log_id existente

AsanaIntegracao.tsx
  + barra de progresso baseada em cursor
  + botão "Retomar"

ProjetoTarefaRow + cards Kanban
  + <AsanaBadge gid={asana_gid} />
```

Quer que eu prossiga com essa implementação?