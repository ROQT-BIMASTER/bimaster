## Diagnóstico

Os logs do Postgres mostram erros massivos em sequência:

```
permission denied for function check_user_access
permission denied for function can_view_profile
permission denied for function user_can_access_projeto
permission denied for function user_can_access_projeto_via_tarefa
```

Verifiquei diretamente no banco: **as 4 funções SECURITY DEFINER perderam todos os GRANTs EXECUTE** (nenhum role — `authenticated`, `anon` ou `public` — pode chamá-las).

```sql
-- Resultado da auditoria: grants = [NULL] para todas
public.check_user_access(uuid, text)
public.can_view_profile(uuid, uuid)
public.user_can_access_projeto(uuid, uuid)
public.user_can_access_projeto_via_tarefa(uuid, uuid)
```

Essas funções são chamadas dentro de **dezenas de RLS policies** (projetos, projeto_membros, profiles, tarefas, anexos, china_*, etc.). Quando o Postgres avalia a policy para um usuário autenticado, a função falha com `permission denied`, e a query inteira retorna 0 linhas ou erro 42501. Por isso os usuários **não conseguem abrir nenhum projeto** — a leitura de `projetos`, `projeto_membros` e `profiles` está quebrada na origem.

A causa provável é uma migration recente (entre as ~10 últimas de hoje) que executou um `REVOKE ALL ON FUNCTION ... FROM PUBLIC` sem o `GRANT EXECUTE TO authenticated` correspondente, ou um `CREATE OR REPLACE FUNCTION` que perdeu os grants prévios em combinação com algum `REVOKE` global.

## O que fazer

Migration única, idempotente, restaurando EXECUTE para `authenticated` (e `service_role` por segurança) nas 4 funções afetadas. Como são `SECURITY DEFINER` com `search_path` fixo, conceder EXECUTE a `authenticated` é o padrão correto e não amplia a superfície de ataque (a lógica de autorização já está dentro da função).

```sql
GRANT EXECUTE ON FUNCTION public.check_user_access(uuid, text)                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid)                   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_projeto(uuid, uuid)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_projeto_via_tarefa(uuid, uuid) TO authenticated, service_role;
```

## Validação pós-migration

1. Rodar `SELECT ... FROM information_schema.routine_privileges WHERE routine_name IN (...)` para confirmar que `authenticated/EXECUTE` aparece para as 4 funções.
2. Conferir nos logs do Postgres (próximos minutos) que o erro `permission denied for function` para esses nomes parou.
3. Pedir a um usuário afetado que recarregue a Central de Trabalho e abra um projeto.

## Investigação complementar (depois do hotfix)

- Fazer `git grep -nE "REVOKE.*FUNCTION|REVOKE.*ON ALL FUNCTIONS"` nas 10 últimas migrations para identificar qual delas removeu os grants e corrigir o template para sempre re-conceder.
- Auditar com `scripts/audit/security-definer-snapshot.mjs` e considerar adicionar uma verificação no CI que falhe se qualquer função SECURITY DEFINER usada em RLS estiver sem `GRANT EXECUTE TO authenticated`.

## Escopo

- 1 migration nova em `supabase/migrations/` apenas com os 4 GRANTs.
- Sem alterações de código frontend.
- Sem alteração de policies (elas estão corretas; o problema é só permissão de execução das funções).
