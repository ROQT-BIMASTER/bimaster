

# Remover chinês do módulo Projetos + Excluir/Restaurar tarefas

## 1. Remover tradução chinesa dos títulos de tarefas (Projetos)

**Problema**: Quando um projeto é criado a partir de uma submissão China (`useChinaProjeto.ts` linha 141), os títulos das tarefas são gerados como `"Texto PT 中文文本"`. O chinês só deve aparecer no módulo China.

**Correção**: Na função `useCriarProjetoChina`, alterar a linha 141:
```
// De:  titulo: `${t.pt} ${t.cn}`
// Para: titulo: t.pt
```

Também remover o chinês do toast de sucesso (linha 177).

---

## 2. Excluir tarefa com possibilidade de restauração (soft delete)

**Abordagem**: Soft delete usando uma coluna `excluida_em` (timestamp). Tarefas excluídas ficam ocultas mas podem ser restauradas.

### 2a. Migration SQL
- Adicionar coluna `excluida_em TIMESTAMPTZ DEFAULT NULL` à tabela `projeto_tarefas`
- Adicionar coluna `excluida_por UUID DEFAULT NULL` (referência ao user)

### 2b. Hook `useProjetoTarefas.ts`
- Filtrar tarefas: adicionar `.is("excluida_em", null)` na query principal (linha 72)
- Adicionar mutation `softDeleteTarefa`: seta `excluida_em = now()` e `excluida_por = user.id`
- Adicionar mutation `restaurarTarefa`: seta `excluida_em = null` e `excluida_por = null`
- Adicionar query `tarefasExcluidas`: busca tarefas onde `excluida_em IS NOT NULL` do projeto

### 2c. UI — Opção de excluir na `ProjetoTarefaRow.tsx`
- Adicionar prop `onDelete` ao componente
- Adicionar ícone de lixeira (Trash2) que aparece no hover da linha, com confirmação via AlertDialog

### 2d. UI — Lixeira de restauração
- Adicionar botão "Lixeira" (ícone Trash2) no `ProjetoHeader.tsx` que abre um dialog/drawer
- O dialog lista tarefas excluídas com nome, data de exclusão e botão "Restaurar"
- Tarefas na lixeira são automaticamente removidas após 30 dias (pode ser feito via cron/cleanup futuro)

### Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Adicionar `excluida_em` e `excluida_por` |
| `src/hooks/useChinaProjeto.ts` | Remover chinês dos títulos (linha 141) e toast (177) |
| `src/hooks/useProjetoTarefas.ts` | Filtrar excluídas, mutations soft delete/restaurar, query lixeira |
| `src/components/projetos/ProjetoTarefaRow.tsx` | Prop `onDelete`, ícone lixeira no hover |
| `src/components/projetos/ProjetoListView.tsx` | Passar `onDelete` para as rows |
| `src/components/projetos/ProjetoHeader.tsx` | Botão "Lixeira" |
| Novo: `src/components/projetos/ProjetoLixeiraDialog.tsx` | Dialog com lista de tarefas excluídas + botão restaurar |

