-- Corrigir views com Security Definer para Security Invoker
-- Isso garante que as views respeitem as políticas RLS do usuário que está consultando

-- 1. sync_tracking_summary
ALTER VIEW public.sync_tracking_summary SET (security_invoker = on);

-- 2. team_performance_view  
ALTER VIEW public.team_performance_view SET (security_invoker = on);

-- 3. vw_analise_departamentos_completa
ALTER VIEW public.vw_analise_departamentos_completa SET (security_invoker = on);

-- 4. vw_clientes_cobranca
ALTER VIEW public.vw_clientes_cobranca SET (security_invoker = on);