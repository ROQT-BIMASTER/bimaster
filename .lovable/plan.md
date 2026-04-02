

# Corrigir Importação de Subtarefas e Fotos/Anexos do Asana

## Problemas Identificados

### 1. Subtarefas não são importadas
O endpoint `/projects/{gid}/tasks` do Asana retorna **apenas tarefas de nível superior**. Subtarefas precisam ser buscadas individualmente via `/tasks/{gid}/subtasks`. Resultado atual: 114 tarefas importadas, **0 subtarefas** (todas com `parent_tarefa_id = null`).

### 2. Anexos/fotos falham silenciosamente
Na linha 443 do insert, o campo `uploaded_by` **não existe** na tabela `projeto_tarefa_anexos` (que só tem: `id, tarefa_id, user_id, nome, storage_path, tipo_arquivo, tamanho, created_at, asana_gid`). O insert falha com erro de coluna desconhecida, mas é capturado pelo catch genérico. Resultado: **0 anexos** importados.

## Correções

### 1. Buscar subtarefas recursivamente

Após o primeiro pass de tarefas, adicionar um loop que para cada tarefa busca `/tasks/{gid}/subtasks` com os mesmos `opt_fields`. As subtarefas são inseridas na mesma tabela `projeto_tarefas` com `parent_tarefa_id` apontando para a tarefa pai local. Recursão de até 3 níveis de profundidade para cobrir subtarefas de subtarefas.

### 2. Remover `uploaded_by` do insert de anexos

Linha 443: remover `uploaded_by: userId` — o campo correto `user_id` já está na linha 444.

### 3. Adicionar contadores ao resultado

Incluir `subtasks_synced` e `attachments_synced` no resultado do sync para visibilidade.

## Arquivo a alterar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/asana-sync/index.ts` | Adicionar fetch de subtarefas recursivo, remover `uploaded_by`, contadores |

## Resultado esperado

Após resync: subtarefas aparecem vinculadas às tarefas pai, fotos e arquivos do Asana ficam acessíveis como anexos das tarefas.

