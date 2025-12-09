-- Fix fabrica_alertas_precos: require authentication for reading pricing data
DROP POLICY IF EXISTS "Todos podem visualizar alertas de preços" ON public.fabrica_alertas_precos;
CREATE POLICY "Authenticated users can view price alerts" ON public.fabrica_alertas_precos
FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- Fix trade_approval_levels: require authentication for financial approval hierarchy
DROP POLICY IF EXISTS "trade_approval_levels_select_all" ON public.trade_approval_levels;
CREATE POLICY "Authenticated users can view approval levels" ON public.trade_approval_levels
FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- Fix departamento_permissoes_modulos: require authentication for permission mappings
DROP POLICY IF EXISTS "Todos podem ver permissões de departamentos - módulos" ON public.departamento_permissoes_modulos;
CREATE POLICY "Authenticated users can view department permissions" ON public.departamento_permissoes_modulos
FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- Fix role_permissoes_modulos: require authentication for role-module access
DROP POLICY IF EXISTS "Todos podem ver permissões de roles" ON public.role_permissoes_modulos;
CREATE POLICY "Authenticated users can view role permissions" ON public.role_permissoes_modulos
FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- Fix telas_sistema: require authentication AND active status check
DROP POLICY IF EXISTS "Todos podem ver telas ativas" ON public.telas_sistema;
CREATE POLICY "Authenticated users can view active screens" ON public.telas_sistema
FOR SELECT USING (
  auth.uid() IS NOT NULL AND ativo = true
);

-- Fix trade_action_points: require authentication for incentive system
DROP POLICY IF EXISTS "Todos podem ver configuração de pontos" ON public.trade_action_points;
CREATE POLICY "Authenticated users can view active points config" ON public.trade_action_points
FOR SELECT USING (
  auth.uid() IS NOT NULL AND is_active = true
);

-- Fix store_categories: require authentication (policy name was misleading)
DROP POLICY IF EXISTS "Usuários autenticados podem ver categorias ativas" ON public.store_categories;
CREATE POLICY "Authenticated users can view active categories" ON public.store_categories
FOR SELECT USING (
  auth.uid() IS NOT NULL AND active = true
);

-- Fix marketing_badges: require authentication for gamification
DROP POLICY IF EXISTS "Anyone can view badges" ON public.marketing_badges;
CREATE POLICY "Authenticated users can view badges" ON public.marketing_badges
FOR SELECT USING (
  auth.uid() IS NOT NULL
);