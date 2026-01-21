
-- Garantir que RLS está habilitado e bloquear acesso anônimo nas tabelas críticas
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

-- Bloquear acesso anônimo em tabelas críticas
CREATE POLICY "clientes_deny_anonymous"
ON public.clientes FOR SELECT
TO anon
USING (false);

CREATE POLICY "contas_pagar_deny_anonymous"
ON public.contas_pagar FOR SELECT
TO anon
USING (false);

CREATE POLICY "contas_receber_deny_anon"
ON public.contas_receber FOR SELECT
TO anon
USING (false);
