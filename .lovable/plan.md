

## Análise de Segurança dos Módulos Recentes

### Problemas Identificados

**1. `projeto_tarefa_documentos` — RLS permissiva demais**

A tabela usa `USING (true) WITH CHECK (true)` para ALL operations. Isso significa que **qualquer usuário autenticado pode ver, editar e deletar documentos de qualquer projeto**, inclusive de projetos aos quais não tem acesso.

As outras tabelas do módulo (`projetos`, `projeto_secoes`, `projeto_tarefas`) já usam funções como `user_can_access_projeto()` e `user_can_access_secao()` para isolar dados. A `projeto_tarefa_documentos` deve seguir o mesmo padrão.

**Correção**: Substituir a política permissiva por uma que valide acesso à tarefa:
```sql
-- SELECT: só vê documentos de tarefas acessíveis
USING (user_can_access_secao(auth.uid(), (SELECT secao_id FROM projeto_tarefas WHERE id = tarefa_id)))

-- INSERT/UPDATE/DELETE: mesmo critério
WITH CHECK (user_can_access_secao(auth.uid(), (SELECT secao_id FROM projeto_tarefas WHERE id = tarefa_id)))
```

**2. Storage bucket `projeto-documentos` — público e sem restrição de path**

O bucket é marcado como `public = true`, permitindo que URLs sejam acessíveis sem autenticação. Além disso, a política de upload (`WITH CHECK (bucket_id = 'projeto-documentos')`) permite que qualquer usuário autenticado faça upload em qualquer path — incluindo sobrescrever arquivos de outros projetos.

**Correção**:
- Tornar o bucket **não-público** (`public = false`) para que URLs exijam token
- Adicionar restrição de path para que uploads fiquem isolados por projeto

**3. Edge Function `projeto-ia-assistant` — sem validação de JWT**

A função não verifica o header `Authorization` nem extrai o usuário autenticado. Qualquer requisição com o anon key pode invocar ações de IA sem ser um usuário logado com permissão ao módulo "projetos".

**Correção**: Adicionar validação de JWT no handler principal:
```ts
const authHeader = req.headers.get("Authorization");
const token = authHeader?.replace("Bearer ", "");
const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token);
if (!user) throw new Error("Não autorizado");
```

### Plano de Implementação

| Arquivo | Alteração |
|---|---|
| **Migration SQL** | Substituir RLS permissiva de `projeto_tarefa_documentos` por políticas baseadas em `user_can_access_secao`; tornar bucket privado |
| `supabase/functions/projeto-ia-assistant/index.ts` | Adicionar validação de JWT no handler principal |
| `src/components/projetos/ProjetoListView.tsx` | Usar URL assinada (`.createSignedUrl`) em vez de `.getPublicUrl` já que bucket será privado |

### Itens já seguros (não requerem mudança)

- **Rotas frontend**: Todas protegidas com `ModuleProtectedRoute moduleCode="projetos"` no `App.tsx`
- **Sidebar**: Já filtra com `hasModulePermission("projetos")`
- **Tabelas `projetos`, `projeto_secoes`, `projeto_tarefas`**: Usam funções `user_can_access_*` para SELECT e validação por `criador_id` para INSERT/DELETE

