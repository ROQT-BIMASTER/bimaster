

# Corrigir Erro "operator does not exist: public.app_role = text"

## Problema

A função `check_user_access` declara a variável `_role` como `text`, mas a coluna `role` na tabela `role_permissoes_modulos` é do tipo `app_role` (enum). O PostgreSQL não aceita comparação direta entre `app_role = text`, causando o erro ao inserir/atualizar qualquer tabela protegida por essa função RLS.

## Correção

### Migration SQL

Recriar a função `check_user_access` com cast explícito na comparação problemática:

```sql
WHERE rpm.role = _role::public.app_role
```

Alternativa (mais segura, evita erro se `_role` não for um valor válido do enum): declarar `_role` como `public.app_role` diretamente, ou usar cast na linha específica.

A correção será aplicada via migration, alterando apenas a linha `WHERE rpm.role = _role` para `WHERE rpm.role = _role::public.app_role`.

## Impacto

- Corrige o cadastro de Produtos Acabados e qualquer outra operação (insert/update/delete/select) em tabelas que usam `check_user_access` via RLS
- Zero mudança visual ou de lógica de negócio

## Arquivo

| Alteração | Tipo |
|---|---|
| Migration SQL: `ALTER FUNCTION check_user_access` | Database |

