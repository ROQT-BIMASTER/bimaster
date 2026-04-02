

# Reconhecer Usuários do Asana + Corrigir Importação de Anexos

## Problemas Identificados

### 1. Usuários do Asana não são criados no sistema
O código atual (linhas 93-109) busca usuários do workspace Asana e tenta casar por email com profiles existentes. Quando não encontra, simplesmente ignora — o `userMap` fica sem entrada e o `responsavel_id` da tarefa fica `null`.

**Resultado**: tarefas ficam sem responsável, comentários são atribuídos ao usuário que rodou o sync.

### 2. Anexos falham silenciosamente
Na linha 371, o insert usa `uploaded_by: userId`, mas a coluna real na tabela é `user_id` (NOT NULL). Isso causa violação de constraint, mas o erro é capturado pelo try/catch e pode não aparecer no log se a exceção for genérica.

### 3. Comentários zerados
O último sync mostra `comments_synced: 0` sem erros. Pode ser que as tarefas desse projeto não tenham comentários, mas também pode ser um problema de paginação ou filtro. Vou adicionar logging para diagnosticar.

---

## Plano de Implementação

### 1. Auto-criar profiles para usuários Asana não encontrados

No bloco de mapeamento de usuários (linhas 100-109), quando não houver match por email:
- Criar um profile placeholder na tabela `profiles` com:
  - `nome`: nome do Asana
  - `email`: email do Asana
  - `aprovado`: false (não pode logar, só serve de referência)
  - `status`: "importado_asana"
- Criar entrada em `user_roles` com role `vendedor` (padrão)
- Adicionar ao `userMap` para que tarefas e comentários fiquem vinculados
- Registrar no `asana_sync_mappings` para deduplicação

**Nota**: Esses profiles NÃO terão conta auth (não podem logar). São registros de referência para vincular tarefas/comentários.

### 2. Corrigir insert de anexos

Linha 363-371 — trocar `uploaded_by: userId` por `user_id: userId`.

### 3. Adicionar logs de diagnóstico nos comentários

Adicionar `console.log` para contar stories retornadas e quantas passam pelo filtro, para diagnosticar se o problema é falta de dados ou filtro.

---

## Detalhes Técnicos

```text
Fluxo atual de usuários:
  Asana user → busca por email → não achou → ignora

Fluxo novo:
  Asana user → busca por email → não achou
    → cria auth.users via admin API (com senha aleatória)
    → cria profile (aprovado=false, status="importado_asana")
    → mapeia no userMap
    → tarefas e comentários ficam vinculados

Anexos:
  uploaded_by: userId  →  user_id: userId
```

### Arquivos a alterar
| Arquivo | Alteração |
|---|---|
| `supabase/functions/asana-sync/index.ts` | Auto-criar profiles, fix `user_id` em anexos, logs em comentários |

### Sem migrations necessárias
A tabela `profiles` já tem os campos necessários. O campo `status` já existe como text.

