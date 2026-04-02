
## Correção proposta: importação do Asana falha por trigger de auditoria

### Diagnóstico
A causa não está mais no mapeamento do Asana em si. O problema atual está no banco:

- A tabela `public.projeto_tarefa_atividades` exige `projeto_id NOT NULL`.
- O trigger novo `audit_projeto_tarefa_changes()` faz `INSERT` nessa tabela sem enviar `projeto_id`.
- Esse trigger roda em `AFTER INSERT OR UPDATE` de `public.projeto_tarefas`.
- Quando o `asana-sync` tenta inserir uma tarefa, o trigger falha e derruba a transação da tarefa.
- Por isso:
  - tarefas não entram
  - comentários não entram
  - anexos/documentos não entram
  - o erro aparece repetido para cada task

### Evidências no código
- `supabase/migrations/20260309234655_...sql`
  - `projeto_tarefa_atividades.projeto_id` é obrigatório
- `supabase/migrations/20260401165220_...sql`
  - o trigger `audit_projeto_tarefa_changes()` insere apenas:
    - `tarefa_id`
    - `user_id`
    - `tipo`
    - `descricao`
    - `campo`
    - `valor_anterior`
    - `valor_novo`
  - `projeto_id` ficou de fora
- `supabase/functions/asana-sync/index.ts`
  - a task já está sendo criada com `projeto_id: localProjectId`
  - então o erro acontece depois, no trigger do banco

## Plano de implementação

### 1. Corrigir o trigger de auditoria
Criar uma migration para atualizar `public.audit_projeto_tarefa_changes()` e incluir `projeto_id` em todos os `INSERTs` na tabela `projeto_tarefa_atividades`.

Ajuste esperado:
- usar `NEW.projeto_id` no `INSERT`
- nas operações de update, usar `COALESCE(NEW.projeto_id, OLD.projeto_id)` por segurança
- manter `tarefa_id = NEW.id`

Exemplo de direção:
```sql
INSERT INTO public.projeto_tarefa_atividades (
  tarefa_id,
  projeto_id,
  user_id,
  tipo,
  descricao,
  campo,
  valor_anterior,
  valor_novo
)
VALUES (
  NEW.id,
  NEW.projeto_id,
  COALESCE(v_user_id, NEW.criador_id),
  ...
);
```

### 2. Consolidar os triggers para evitar duplicidade
Hoje existem dois mecanismos de histórico sobre `projeto_tarefas`:
- `tr_log_projeto_tarefa_changes`
- `trg_audit_projeto_tarefa`

Isso tende a gerar histórico duplicado em updates.

Vou ajustar a migration para manter apenas um fluxo de auditoria consistente:
- preferencialmente preservar o trigger mais novo (`audit_projeto_tarefa_changes`)
- remover o trigger antigo `tr_log_projeto_tarefa_changes` se ele estiver redundante

Resultado:
- elimina duplicidade futura
- deixa o histórico coerente
- reduz risco de novos conflitos

### 3. Não alterar o fluxo do Asana
O `asana-sync/index.ts` não precisa de mudança estrutural para esse erro específico, porque ele já envia `projeto_id` corretamente ao criar a tarefa.

Ou seja:
- sem mudança obrigatória no frontend
- sem mudança obrigatória no edge function para corrigir esta falha
- a correção principal é no banco/trigger

### 4. Validar impacto esperado após correção
Depois da migration:
- a criação das tarefas deixa de falhar
- o sync passa a seguir para:
  - subtarefas/pais
  - seguidores
  - tags
  - dependências
  - anexos/documentos
  - comentários

### 5. Verificação pós-correção
Após aplicar a correção, validar este fluxo:
1. rodar sync de um workspace/projeto com tarefas
2. confirmar que tarefas foram criadas
3. confirmar que anexos apareceram em `projeto_tarefa_anexos`
4. confirmar que comentários apareceram em `projeto_tarefa_comentarios`
5. confirmar que o histórico da tarefa abriu sem erros e sem registros duplicados

## Detalhes técnicos
```text
Asana Sync
   -> insert em projeto_tarefas (com projeto_id correto)
      -> trigger audit_projeto_tarefa_changes()
         -> insert em projeto_tarefa_atividades
            -> hoje falha por faltar projeto_id
            -> após ajuste, task passa a ser persistida
```

### Arquivos/recursos a alterar
- `supabase/migrations/<nova_migration>.sql`
  - recriar `public.audit_projeto_tarefa_changes()`
  - incluir `projeto_id` nos inserts
  - remover trigger antigo redundante, se aplicável

### Escopo
- sem novas tabelas
- sem alterações de UI obrigatórias
- sem mudança no contrato da integração
- correção focada no banco e no pipeline de auditoria

### Resultado esperado
Os 31 erros de:
```text
null value in column "projeto_id" of relation "projeto_tarefa_atividades"
```
deixam de acontecer, e a importação do Asana passa a carregar tarefas, documentos/anexos e comentários normalmente.
