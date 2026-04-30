## Objetivo

Concluir a migração Asana → schema local com normalização robusta de enums, suporte a hierarquia (subtarefas), captura de canal de criação, seguidores, anexos e UI para navegação dessa estrutura.

## 1. Extensões de schema

Adicionar via migração:

- `projeto_tarefas.canal_criacao text` — armazena o valor do custom field "Canal de Criação" (Interno, Anúncio, Embalagens, etc.). Índice parcial para filtros.
- `projeto_tarefas.is_subtask boolean default false` — preenchido por trigger (`NEW.parent_tarefa_id IS NOT NULL`) e usado em filtros.
- `projeto_tarefas.origem_projeto text` — replica origem direta na tarefa (já existe em `projetos`), preenchido com o nome do projeto Asana de origem.
- Nova tabela `projeto_tarefa_seguidores`:
  - `tarefa_id uuid` (FK CASCADE), `user_id uuid` (FK profiles), `asana_gid text`, `created_at`.
  - PK composta `(tarefa_id, user_id)`.
  - RLS: SELECT/INSERT/DELETE seguindo o mesmo padrão de `projeto_tarefa_colaboradores` (acesso via `user_can_access_projeto_via_tarefa`).

## 2. Edge function `asana-sync` — normalização e enriquecimento

Atualizações em `supabase/functions/asana-sync/index.ts`:

- Aumentar `opt_fields` em `/projects/{gid}/tasks` para incluir `num_subtasks`, `attachments`, e o custom field "Canal de Criação".
- No loop de tasks:
  - Após o cálculo de `cfMap`, extrair `canal_criacao` aceitando aliases: `canal de criação`, `canal de criacao`, `canal`, `channel`.
  - Preencher `taskData.canal_criacao` e `taskData.origem_projeto = proj.data.name`.
- **Mapeamento de seguidores** (mesma página, novo passo):
  - Para cada task com `followers`, fazer `upsert` em `projeto_tarefa_seguidores` usando `userMap` para mapear `follower.gid → profiles.id`.
  - Remover seguidores que não estão mais no Asana (delete por `tarefa_id` + `asana_gid` que não estão no array atual).

## 3. Subtarefas — segundo passo dentro da fase `core`

- Após processar a página de tasks top-level e antes de avançar `pageOffset`, para cada task com `num_subtasks > 0`:
  - Chamar `/tasks/{parent_gid}/subtasks` paginado (mesmo helper `asanaGetPage`) com os mesmos `opt_fields`.
  - Para cada subtask, aplicar a mesma lógica de upsert em `projeto_tarefas`, **populando `parent_tarefa_id` com o id local recém-resolvido** e copiando `secao_id` da pai.
  - Aplicar skip-if-unchanged via `modified_at`.
  - Incrementar `subtasksSynced`.
- Persistir `subtasksSynced` em `asana_sync_log` (já existe a coluna).
- Cursor permanece no nível de página da task pai; subtarefas são resolvidas inline. Se `timeLeft() < 5000` durante subtarefas, sair com `coreComplete = false` e `lastPageOffset` atual (a página será re-processada — skip-if-unchanged evita custo).

## 4. Anexos — fase `secondary`

A fase `secondary` (já estruturada) ganha um novo passo dedicado:

- Para cada task local com `asana_gid` cujo `asana_json_raw->'attachments'` indique presença de anexos (ou via flag `has_attachments`), chamar `/tasks/{gid}/attachments?opt_fields=name,download_url,permanent_url,resource_subtype,size,host`.
- Para cada anexo:
  - Pular se já existe `projeto_tarefa_anexos.asana_gid = attachment.gid`.
  - Se `download_url` (Asana hospedado) disponível: baixar via `fetch`, fazer upload para o bucket `projeto-anexos` em `imported/asana/{tarefa_id}/{gid}-{nome}` usando o admin client, e inserir registro em `projeto_tarefa_anexos` com `user_id = userId` (importador), `nome`, `storage_path`, `tipo_arquivo` (content-type ou extensão), `tamanho`, `asana_gid`.
  - Se `host = external` (Drive/Dropbox): salvar metadados sem download — `storage_path` recebe a URL externa prefixada com `external://` para distinguir do path real; UI tratará como link.
- Respeitar `timeLeft()` com break controlado e cursor próprio em `asana_sync_log.cursor.attachmentsCursor` para retomar.
- Limites de segurança: pular arquivos > 50 MB e logar em `errors`.

## 5. Hook frontend `useAsanaSync`

- Aumentar `maxSecondaryAttempts` para suportar a nova carga de anexos.
- Atualizar mensagens de progresso para mostrar `subtasksSynced` e `attachmentsSynced`.

## 6. UI

### 6.1. Filtro lateral por Canal de Criação

- Em `src/components/projetos/lista/` (ou painel de filtros do projeto, seguindo o padrão atual): adicionar grupo "Canal de Criação" alimentado dinamicamente via query distinta em `projeto_tarefas.canal_criacao` no projeto atual.
- Selecionar múltiplas opções aplica `.in('canal_criacao', selecionados)` na query principal.
- Persistir seleção em `usePageBgColor` companion (localStorage por projeto).

### 6.2. Visualização indentada de subtarefas

- Em `ProjetoTarefaRow.tsx`: detectar `parent_tarefa_id` e renderizar com `padding-left` proporcional a 1 nível (suficiente — Asana normalmente tem 1 nível).
- Em `useTarefasProjeto` (ou query equivalente): ordenar por `parent_tarefa_id NULLS FIRST, ordem` e agrupar filhas logo após o pai. Adicionar botão chevron na linha do pai para colapsar/expandir filhas.
- Manter `AsanaBadge` existente em pais e filhas.

## 7. Migração de dados (one-shot)

Após deploy, executar (via tool `supabase--insert`):

```sql
-- Backfill is_subtask para o que já existe
UPDATE projeto_tarefas
SET is_subtask = true
WHERE parent_tarefa_id IS NOT NULL AND is_subtask = false;

-- Backfill origem_projeto via projetos
UPDATE projeto_tarefas pt
SET origem_projeto = p.origem_projeto
FROM projetos p
WHERE pt.projeto_id = p.id
  AND pt.origem_projeto IS NULL
  AND p.origem_projeto IS NOT NULL;

-- Backfill canal_criacao a partir de campos_customizados já salvos
UPDATE projeto_tarefas
SET canal_criacao = trim(campos_customizados->>'Canal de Criação')
WHERE canal_criacao IS NULL
  AND campos_customizados ? 'Canal de Criação';
```

## 8. Pontos de atenção implementados

- **TRIM e dedup de enums:** já em vigor; estendido para `canal_criacao`.
- **Subtarefas órfãs:** resolvidas inline após a pai → `parent_tarefa_id` sempre existe no momento do insert.
- **Seguidores:** nova tabela com RLS espelhada de colaboradores.
- **Anexos:** baixados quando hospedados pelo Asana, referenciados quando externos. Bucket `projeto-anexos` reutilizado.
- **Idempotência:** todos os passos usam `asana_gid` como chave natural; reexecução é segura.

## Resumo dos arquivos afetados

- Migração SQL (nova): colunas `canal_criacao`, `is_subtask`, `origem_projeto` em `projeto_tarefas`; tabela `projeto_tarefa_seguidores`; trigger `is_subtask`; índice em `canal_criacao`; backfill (na verdade via tool insert separada).
- `supabase/functions/asana-sync/index.ts` — normalização canal, seguidores, subtarefas e anexos.
- `src/hooks/useAsanaSync.ts` — limites e progresso.
- `src/components/projetos/ProjetoTarefaRow.tsx` — indentação de subtarefa + chevron.
- Hook/query de listagem de tarefas — ordenação pai→filha.
- Painel de filtros do projeto — grupo "Canal de Criação".

## Fora de escopo (não nesta rodada)

- Tabela `projeto_tarefa_tags` (Asana retorna tags, mas usuário não solicitou).
- Sincronização reversa (Lovable → Asana).
- Importação de comentários históricos além do que a fase `secondary` já faz.