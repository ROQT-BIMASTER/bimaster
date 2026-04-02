

# Corrigir Importação de Colaboradores do Asana

## Diagnóstico

O código de sync de followers já existe (linhas 327-345), mas provavelmente **não está funcionando** por dois motivos:

1. **`followers.gid` não está nos `opt_fields`** — a API do Asana pode não retornar o `gid` dos followers sem solicitação explícita no endpoint de listagem de tarefas
2. **Sem logging** — se followers vieram vazios ou sem gid, o `continue` silencioso não deixa rastro
3. **Possível limitação do endpoint de lista** — o Asana pode não expandir `followers` no bulk `/projects/{gid}/tasks`. Pode ser necessário buscar followers por tarefa individualmente via `/tasks/{gid}` com opt_fields incluindo `followers.gid,followers.email,followers.name`

## Correções

### 1. Adicionar `followers.gid` nos opt_fields (linha 243)

Incluir `followers.gid,followers.name` no `opt_fields` da chamada de tasks:

```
followers,followers.gid,followers.email,followers.name
```

### 2. Fallback: buscar followers individualmente quando bulk retornar vazio

Se `task.followers` vier undefined/vazio apesar de existir no Asana, fazer uma chamada individual:
```
GET /tasks/{gid}?opt_fields=followers,followers.gid,followers.email
```

### 3. Adicionar logging de diagnóstico

Logar quantos followers foram encontrados por tarefa e quantos foram mapeados com sucesso, para facilitar debug futuro.

### 4. Contar colaboradores no resultado do sync

Adicionar um contador `collaboratorsSynced` ao resultado para visibilidade.

## Arquivo a alterar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/asana-sync/index.ts` | Fix opt_fields, fallback individual, logging, contador |

## Resultado esperado

Após resync, as tarefas do Asana terão seus colaboradores/seguidores importados e visíveis na UI (que já exibe avatars de colaboradores na listagem e no detalhe da tarefa).

