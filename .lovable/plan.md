

## Filtrar Contas a Pagar por Empresa do Usuário (RLS)

### Situação Atual
A política RLS `cp_select` em `contas_pagar` permite acesso a **todos os registros** para qualquer usuário com permissão ao módulo `financeiro`. Não há filtro por empresa. A função `user_has_empresa_access(user_id, empresa_id)` já existe no banco.

### Solução
Atualizar a política RLS de SELECT da `contas_pagar` para incluir filtro por empresa usando a função existente `user_has_empresa_access`. Admins continuam vendo tudo; funcionários veem apenas registros das empresas vinculadas a eles via `user_empresas`.

### Mudanças

#### 1. Migração SQL
Substituir a política `cp_select` por uma nova que combina acesso ao módulo financeiro **E** filtro por empresa:

```sql
DROP POLICY IF EXISTS "cp_select" ON public.contas_pagar;

CREATE POLICY "cp_select_empresa" ON public.contas_pagar
FOR SELECT TO authenticated
USING (
  public.check_user_access(auth.uid(), 'financeiro')
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);
```

A função `user_has_empresa_access` já trata:
- `empresa_id IS NULL` (dados legados) -> permite
- Admin/Supervisor -> vê tudo
- Demais usuários -> apenas empresas vinculadas em `user_empresas`

Fazer o mesmo para INSERT e UPDATE:

```sql
DROP POLICY IF EXISTS "cp_insert" ON public.contas_pagar;
CREATE POLICY "cp_insert_empresa" ON public.contas_pagar
FOR INSERT TO authenticated
WITH CHECK (
  public.check_user_access(auth.uid(), 'financeiro')
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);

DROP POLICY IF EXISTS "cp_update" ON public.contas_pagar;
CREATE POLICY "cp_update_empresa" ON public.contas_pagar
FOR UPDATE TO authenticated
USING (
  public.check_user_access(auth.uid(), 'financeiro')
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);
```

A política de DELETE (`cp_delete_hardened`) permanece apenas para admin.

#### 2. Sem mudanças no frontend
O `ContasAPagar.tsx` já tem filtros de empresa no frontend. O RLS agora garante que o banco só retorna dados das empresas autorizadas, independente do filtro frontend.

### Impacto
- Funcionários do financeiro sem vínculo em `user_empresas` verão 0 registros (precisam ser vinculados)
- Admins e supervisores continuam com visão total (tratado pela `user_has_empresa_access`)
- Dados legados sem `empresa_id` continuam acessíveis

