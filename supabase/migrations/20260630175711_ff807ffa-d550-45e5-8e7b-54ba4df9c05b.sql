CREATE TABLE IF NOT EXISTS public.canhoto_rubysp (
  rubysp_pedido_id bigint primary key,
  status        text not null default 'pendente',
  storage_path  text,
  mime          text,
  local         text,
  motivo        text,
  solicitado_em timestamptz not null default now(),
  processado_em timestamptz
);

GRANT SELECT ON public.canhoto_rubysp TO authenticated;
GRANT ALL    ON public.canhoto_rubysp TO service_role;

ALTER TABLE public.canhoto_rubysp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "canhoto_rsp_sel" ON public.canhoto_rubysp;
CREATE POLICY "canhoto_rsp_sel" ON public.canhoto_rubysp FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.solicitar_canhoto_rubysp(p_pedido_id bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st text;
BEGIN
  INSERT INTO public.canhoto_rubysp (rubysp_pedido_id, status, solicitado_em)
  VALUES (p_pedido_id, 'pendente', now())
  ON CONFLICT (rubysp_pedido_id) DO UPDATE
    SET status = CASE WHEN public.canhoto_rubysp.status = 'pronto' THEN 'pronto' ELSE 'pendente' END,
        solicitado_em = now()
  RETURNING status INTO st;
  RETURN st;
END $$;

REVOKE ALL ON FUNCTION public.solicitar_canhoto_rubysp(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.solicitar_canhoto_rubysp(bigint) TO authenticated;

-- Storage: bucket "canhotos" privado — sem policies de acesso direto pelo cliente.
-- Leitura é feita via signed URL emitida pela própria UI (createSignedUrl usa service role no edge / chave anon assinada pelo backend).
-- Para garantir bloqueio explícito, não criamos policies em storage.objects para o bucket — sem policy = sem acesso por anon/authenticated, apenas service_role.