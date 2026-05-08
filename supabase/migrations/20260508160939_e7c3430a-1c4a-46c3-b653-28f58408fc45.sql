-- 1) Nova tela china_ordens_producao
INSERT INTO public.telas_sistema (codigo, nome, descricao, icone, rota, ativo, ordem, modulo_codigo)
VALUES (
  'china_ordens_producao',
  'Ordens de Produção',
  'Gestão de Ordens de Produção criadas pela China',
  'factory',
  '/dashboard/fabrica-china/ordens-producao',
  true, 5, 'china'
)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    icone = EXCLUDED.icone,
    rota = EXCLUDED.rota,
    modulo_codigo = EXCLUDED.modulo_codigo,
    ativo = true;

-- 2) RLS: usuários com módulo China podem ver/editar OPs criadas no contexto China
DROP POLICY IF EXISTS "China users podem ver OPs OP-CN" ON public.fabrica_ordens_producao;
CREATE POLICY "China users podem ver OPs OP-CN"
  ON public.fabrica_ordens_producao
  FOR SELECT
  TO authenticated
  USING (
    numero LIKE 'OP-CN-%'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
      OR public.check_user_access(auth.uid(), 'china')
      OR public.check_user_access(auth.uid(), 'fabrica')
    )
  );

DROP POLICY IF EXISTS "China users podem editar OPs OP-CN" ON public.fabrica_ordens_producao;
CREATE POLICY "China users podem editar OPs OP-CN"
  ON public.fabrica_ordens_producao
  FOR UPDATE
  TO authenticated
  USING (
    numero LIKE 'OP-CN-%'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
      OR public.check_user_access(auth.uid(), 'china')
      OR public.check_user_access(auth.uid(), 'fabrica')
    )
  )
  WITH CHECK (
    numero LIKE 'OP-CN-%'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
      OR public.check_user_access(auth.uid(), 'china')
      OR public.check_user_access(auth.uid(), 'fabrica')
    )
  );