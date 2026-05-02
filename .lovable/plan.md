## Diagnóstico

A tela "Vincular China" (`/dashboard/projetos/vincular-china`) carrega as listas a partir de duas tabelas:

- `china_produto_submissoes` → produtos
- `china_produto_documentos` → documentos

As RLS atuais dessas tabelas (verificadas no banco) só liberam SELECT para 3 perfis:

```sql
-- china_sub_select
created_by = auth.uid()
OR has_role(uid, 'admin')
OR has_role(uid, 'supervisor')
OR check_user_access(uid, 'fabrica')   -- ← apenas módulo "fabrica"

-- china_doc_select
EXISTS (... mesma condição via submissão pai)
```

Mas a tela é **uma tela do módulo Projetos**, protegida pelo guard
`<ModuleRoute moduleCode="projetos">` + `<ScreenProtectedRoute screenCode="projetos_vincular_china">`. Quem tem acesso só ao módulo **`projetos`** (ou só ao módulo **`china`**) consegue **abrir a página, mas o banco devolve 0 linhas silenciosamente** — sem 403, sem erro no console. Daí a queixa "produtos e documentos não aparecem".

Confirmações:

- Banco tem **24 submissões ativas com produto** preenchido → não é falta de dado.
- Logs do Postgres dos últimos 5 min: **0 erros** → não é falha de runtime, é filtro de visibilidade.
- O filtro frontend (`ProjetoVincularChina.tsx:171`: `produto_codigo && produto_nome && produto_codigo !== "null"`) não zera nada porque os 24 ativos têm os campos preenchidos.
- Existe um módulo separado `china` ("Fábrica China") ativo em `modulos_sistema`, **mas as policies não o reconhecem** — só `fabrica`.

## Causa raiz

Desalinhamento de governança entre rota e RLS:

| Camada | Quem libera |
|---|---|
| Rota / Sidebar | módulo `projetos` |
| Tela `projetos_vincular_china` | qualquer um com a tela |
| RLS `china_produto_submissoes` | só `fabrica` + admin/supervisor |
| RLS `china_produto_documentos` | só `fabrica` + admin/supervisor |

Resultado: usuários de **Projetos / Operações China / Dev** que deveriam usar a tela ficam com lista vazia.

## O que fazer

**1 migration** atualizando as 4 policies (`china_sub_select`, `china_sub_update`, `china_doc_select`, `china_doc_update`) para também reconhecer:

- módulo `china` (`check_user_access(uid, 'china')`) — explícito, alinhado a `modulos_sistema`
- módulo `projetos` em modo **leitura** (`check_user_access(uid, 'projetos')`) — só nas policies de SELECT, para a tela funcionar para quem está fazendo o vínculo

Update/Delete continuam exigindo `fabrica` / `china` / admin / supervisor — sem ampliar superfície de escrita para módulo `projetos`.

```sql
-- exemplo china_sub_select (DROP + CREATE)
DROP POLICY china_sub_select ON public.china_produto_submissoes;
CREATE POLICY china_sub_select ON public.china_produto_submissoes
FOR SELECT TO authenticated
USING (
  created_by = (SELECT auth.uid())
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'supervisor'::public.app_role)
  OR public.check_user_access((SELECT auth.uid()), 'fabrica')
  OR public.check_user_access((SELECT auth.uid()), 'china')
  OR public.check_user_access((SELECT auth.uid()), 'projetos')
);
-- mesma estrutura para china_doc_select via EXISTS na submissão
-- update mantém apenas fabrica + china + admin/supervisor (sem projetos)
```

## Validação pós-migration

1. `SELECT count(*) FROM china_produto_submissoes` impersonando um usuário só do módulo `projetos` → deve retornar 24.
2. Recarregar a tela "Vincular China" — produtos e documentos devem aparecer.
3. Conferir nos logs do Postgres que nenhum novo `permission denied` apareceu.
4. Conferir que usuário sem `projetos` / `china` / `fabrica` continua com 0 linhas (regressão).

## Escopo

- 1 migration em `supabase/migrations/`.
- Sem mudanças no frontend.
- Sem alteração de UPDATE/DELETE — escrita continua restrita.

## Observação fora de escopo (não fazer agora)

Quem montar o módulo `china` deveria revisar o "espelho" de policies em outras tabelas China (`china_pasta_digital`, `china_ordens_compra`, `china_recebimentos_carga` etc.) para também aceitar o módulo `china` por código — algumas estão hard-coded em `fabrica`. Posso preparar isso em um segundo plano se você quiser.
