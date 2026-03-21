

# Plano: Corrigir 3 erros de segurança

## Problema

Três tabelas financeiras — `parcelas_receber`, `recebimentos` e `lancamentos_conta_corrente` — não têm RLS habilitado e concedem acesso ao role `anon`, expondo dados financeiros a chamadas não autenticadas.

As views com Security Definer já foram todas corrigidas (todas usam `security_invoker=on`), então o alerta restante do Supabase linter deve desaparecer após a correção das tabelas.

## Alterações (1 migration SQL)

1. **Habilitar RLS** nas 3 tabelas
2. **Revogar grants do `anon`** nas 3 tabelas
3. **Criar políticas de acesso** seguindo o padrão financeiro existente (`check_user_access`):

| Tabela | Políticas |
|---|---|
| `parcelas_receber` | SELECT, INSERT, UPDATE para `authenticated` com `check_user_access(auth.uid(), 'financeiro')` ou admin |
| `recebimentos` | SELECT, INSERT, UPDATE para `authenticated` com `check_user_access(auth.uid(), 'financeiro')` ou admin |
| `lancamentos_conta_corrente` | SELECT, INSERT, UPDATE para `authenticated` com `check_user_access(auth.uid(), 'financeiro')` ou admin |

Cada política usará:
```sql
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR check_user_access(auth.uid(), 'financeiro')
)
```

Nenhum arquivo frontend precisa ser alterado.

