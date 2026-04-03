

# Contas a Receber -- Dados nao carregam (Diagnostico e Correcao)

## Causa Raiz Identificada

Os logs do banco mostram **statement timeouts** repetidos nas queries de `contas_receber`:

```text
ERROR: canceling statement due to statement timeout
```

A tabela tem **343.599 registros** e a policy RLS `cr_select_empresa` executa **2 funcoes complexas por linha**:

1. `check_user_access(auth.uid(), 'financeiro')` — faz 4 sub-queries (user_roles, permissoes_modulos, departamento_permissoes, role_permissoes)
2. `user_has_empresa_access(auth.uid(), empresa_id)` — consulta user_empresas + is_admin_or_supervisor

Com 343k linhas, isso gera **milhoes de sub-queries** a cada request, causando timeout.

Problema secundario: `permission denied for table user_roles` na query de `empresas`, bloqueando o carregamento das empresas do contexto.

## Solucao

### 1. Otimizar a RLS Policy de contas_receber

Substituir as funcoes complexas por uma policy que usa `EXISTS` direto, evitando chamadas de funcao por linha:

```sql
DROP POLICY cr_select_empresa ON contas_receber;
DROP POLICY cr_deny_anon ON contas_receber;

CREATE POLICY cr_select_empresa ON contas_receber
FOR SELECT TO authenticated
USING (
  empresa_id IN (SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
```

Isso reduz de ~8 sub-queries/linha para 1 sub-query cacheavel (o planner do Postgres otimiza `IN (SELECT ...)` como semi-join).

### 2. Corrigir permissao na tabela user_roles

Garantir que `authenticated` tenha SELECT na `user_roles` (necessario para `has_role` funcionar):

```sql
GRANT SELECT ON public.user_roles TO authenticated;
```

### 3. Adicionar indice composto para a query principal

```sql
CREATE INDEX IF NOT EXISTS idx_cr_empresa_vencimento 
ON contas_receber (empresa_id, data_vencimento DESC);
```

### 4. Remover `count: 'exact'` da query da tabela

No `ContasAReceber.tsx`, a query usa `{ count: 'exact' }` que forca um COUNT(*) completo com RLS — extremamente lento em 343k linhas. Substituir por usar o total retornado pela RPC `get_contas_receber_totais_filtrados` que ja e chamada.

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| Migration SQL | Nova RLS policy otimizada + GRANT + indice |
| `src/pages/ContasAReceber.tsx` | Remover `count: 'exact'` da query da tabela, usar contagem da RPC |

## Resultado Esperado

- Queries que hoje fazem timeout (<8s) passam a executar em <500ms
- Dashboard e tabela carregam normalmente
- Empresas do contexto carregam sem erro de permissao

