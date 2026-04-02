

# Adicionar colunas de subtarefas, anexos e colaboradores ao histórico de sync

## Problema
A tabela `asana_sync_log` só tem colunas para `projects_synced`, `sections_synced`, `tasks_synced`, `comments_synced` e `users_mapped`. Faltam `subtasks_synced`, `attachments_synced` e `collaborators_synced`. O edge function já retorna esses valores no JSON, mas não os salva no log — por isso a tabela mostra tudo zerado.

## Plano

### 1. Migration: adicionar 3 colunas à `asana_sync_log`
```sql
ALTER TABLE asana_sync_log ADD COLUMN subtasks_synced integer DEFAULT 0;
ALTER TABLE asana_sync_log ADD COLUMN attachments_synced integer DEFAULT 0;
ALTER TABLE asana_sync_log ADD COLUMN collaborators_synced integer DEFAULT 0;
```

### 2. Edge function (`asana-sync/index.ts`)
- No update do log na fase "core_done" (linha 298): incluir `collaborators_synced`
- No update do log na fase "completed" (linha 435): incluir `subtasks_synced`, `attachments_synced`, `collaborators_synced`
- No update parcial "secondary_partial" (linha 335): incluir `subtasks_synced`, `attachments_synced`

### 3. Hook `useAsanaSync.ts`
- Adicionar `subtasks_synced`, `attachments_synced`, `collaborators_synced` à interface `SyncLog`

### 4. UI `AsanaIntegracao.tsx`
- Adicionar colunas "Subtarefas", "Anexos", "Colaboradores" à tabela de histórico

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| Migration SQL | 3 novas colunas |
| `supabase/functions/asana-sync/index.ts` | Salvar contadores no log |
| `src/hooks/useAsanaSync.ts` | Atualizar interface SyncLog |
| `src/pages/AsanaIntegracao.tsx` | Exibir novas colunas na tabela |

