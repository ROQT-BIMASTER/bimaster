## Problema identificado

Atualmente, o autocomplete de menção (`@`) nos chats e comentários de tarefas exibe **todos os perfis cadastrados** no sistema (`profiles`), conforme observado nos hooks:

- `src/hooks/useProjetoTarefaDetalhe.ts` (linha 410-421)
- `src/hooks/useMinhasTarefaDetalhe.ts` (linha 167-178)

Ambos executam `supabase.from("profiles").select("id, nome, avatar_url")` sem nenhum filtro de escopo, resultando na lista global de usuários (Administrador Sistema, Adriana, Agência Kilo, Ahmad, Aldry…) — exatamente o cenário da imagem enviada.

## Escopo de "usuários vinculados ao processo"

Como não existe tabela `process_members`, o conjunto de usuários elegíveis para menção é a **união** das seguintes fontes (todas já existentes no banco):

1. **Membros do projeto** — `projeto_membros.user_id` onde `projeto_id = tarefa.projeto_id`
2. **Responsável e criador da tarefa** — `projeto_tarefas.responsavel_id` e `criador_id`
3. **Criador do processo** — `product_process.criado_por` (quando a tarefa tem processo vinculado via `produto_id`)
4. **Participantes do chat do processo** — `process_chat_messages.user_id` distintos (quem já interagiu no processo)

Esta união garante que apenas pessoas com vínculo real ao processo apareçam no `@`.

## Mudanças propostas

### 1. Novo hook compartilhado `useTarefaMentionableUsers.ts` (novo)

Criar um hook que recebe `tarefaId` e retorna a lista filtrada:

```typescript
export function useTarefaMentionableUsers(tarefaId: string | null) {
  return useQuery({
    queryKey: ["tarefa-mentionable-users", tarefaId],
    queryFn: async () => {
      // 1. Buscar tarefa para obter projeto_id, produto_id, responsavel_id, criador_id
      // 2. Buscar projeto_membros do projeto
      // 3. Buscar product_process pelo produto_id (se houver) e seus participantes
      // 4. Unificar IDs, dedup, então buscar profiles correspondentes
      // 5. Retornar { id, nome, avatar_url }[] ordenado por nome
    },
    enabled: !!tarefaId,
    staleTime: 60 * 1000,
  });
}
```

### 2. Substituir `teamMembers` global pelos usuários vinculados

- **`src/hooks/useProjetoTarefaDetalhe.ts`**: remover o query `team-members-mentions` global e expor `teamMembers` vindo do novo hook (chamado internamente com `tarefaId`).
- **`src/hooks/useMinhasTarefaDetalhe.ts`**: aplicar a mesma substituição.

A interface pública (`teamMembers` no retorno) permanece idêntica — nenhum componente consumidor precisa mudar a assinatura.

### 3. Componentes consumidores (sem mudanças de API)

Os seguintes componentes continuam recebendo `teamMembers` como prop, agora já filtrados:
- `TarefaComentariosSection.tsx`
- `TarefaChatPanel.tsx`
- `MinhasTarefaChat.tsx`

### 4. Fallback de segurança

Se a tarefa não tem `projeto_id` nem processo vinculado, o hook retorna **apenas** o responsável + criador da tarefa (nunca a lista global), garantindo o princípio de menor exposição.

## Resultado esperado

Ao digitar `@` no chat ou comentário de uma tarefa, o usuário verá **apenas**:
- Membros do projeto da tarefa
- Responsável e criador da tarefa  
- Criador do processo vinculado
- Participantes que já interagiram no chat do processo

Removendo nomes irrelevantes como "Administrador Sistema", "Agência Kilo" etc. quando não fazem parte do processo.

## Arquivos afetados

- **Novo**: `src/hooks/useTarefaMentionableUsers.ts`
- **Editado**: `src/hooks/useProjetoTarefaDetalhe.ts`
- **Editado**: `src/hooks/useMinhasTarefaDetalhe.ts`

Nenhuma mudança de schema ou RLS é necessária — todas as tabelas envolvidas já são acessíveis aos usuários autenticados via políticas existentes.