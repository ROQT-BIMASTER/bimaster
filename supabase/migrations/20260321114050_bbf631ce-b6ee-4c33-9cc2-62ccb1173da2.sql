-- 1) Adicionar colunas na tabela clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cod_vend INTEGER;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS vendedor TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cod_equipe INTEGER;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS nome_equipe TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS supervisor TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS id_empresa INTEGER;

-- 2) Índices para performance RLS
CREATE INDEX IF NOT EXISTS idx_clientes_cod_vend ON public.clientes(cod_vend);
CREATE INDEX IF NOT EXISTS idx_clientes_id_empresa ON public.clientes(id_empresa);

-- 3) RLS policies (complementam as existentes)
CREATE POLICY "vendedor_clientes_own" ON public.clientes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.dim_vendedor dv
    WHERE dv.user_id = auth.uid() AND dv.cod_vend = clientes.cod_vend
  )
);

CREATE POLICY "supervisor_clientes_team" ON public.clientes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.dim_supervisor ds
    WHERE ds.user_id = auth.uid() AND ds.nome_supervisor = clientes.supervisor
  )
);

CREATE POLICY "empresa_clientes_access" ON public.clientes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_empresa_access uea
    WHERE uea.user_id = auth.uid() AND uea.id_empresa = clientes.id_empresa
  )
);