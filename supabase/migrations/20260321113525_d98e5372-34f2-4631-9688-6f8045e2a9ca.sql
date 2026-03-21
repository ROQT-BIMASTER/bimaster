-- Habilitar RLS na vendas_union
ALTER TABLE public.vendas_union ENABLE ROW LEVEL SECURITY;

-- 1) Admin vê tudo (usa função has_role já existente)
CREATE POLICY "admin_vendas_full_access" ON public.vendas_union
FOR ALL USING (
  public.has_role(auth.uid(), 'admin')
);

-- 2) Vendedor vê apenas suas vendas
CREATE POLICY "vendedor_vendas_own_data" ON public.vendas_union
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.dim_vendedor dv
    WHERE dv.user_id = auth.uid() AND dv.cod_vend = vendas_union.cod_vend
  )
);

-- 3) Supervisor vê vendas da sua equipe
CREATE POLICY "supervisor_vendas_team_data" ON public.vendas_union
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.dim_supervisor ds
    WHERE ds.user_id = auth.uid() AND ds.nome_supervisor = vendas_union.supervisor
  )
);

-- 4) Acesso por empresa
CREATE POLICY "empresa_vendas_access" ON public.vendas_union
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_empresa_access uea
    WHERE uea.user_id = auth.uid() AND uea.id_empresa = vendas_union.id_empresa
  )
);

-- 5) Dimensões: leitura para autenticados
CREATE POLICY "authenticated_read_dim_empresa" ON public.dim_empresa
FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_dim_vendedor" ON public.dim_vendedor
FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_dim_supervisor" ON public.dim_supervisor
FOR SELECT TO authenticated USING (true);

-- 6) user_empresa_access: cada user vê só seus registros
CREATE POLICY "user_own_empresa_access" ON public.user_empresa_access
FOR SELECT USING (user_id = auth.uid());

-- Admin pode gerenciar user_empresa_access
CREATE POLICY "admin_manage_empresa_access" ON public.user_empresa_access
FOR ALL USING (public.has_role(auth.uid(), 'admin'));