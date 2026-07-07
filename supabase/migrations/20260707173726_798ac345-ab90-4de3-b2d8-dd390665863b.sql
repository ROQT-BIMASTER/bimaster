GRANT SELECT ON public.faturamento_mensal TO authenticated;
GRANT ALL ON public.faturamento_mensal TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_faturamento_rubysp TO service_role;