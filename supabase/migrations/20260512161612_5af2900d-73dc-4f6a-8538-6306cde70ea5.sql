
-- Função SECURITY DEFINER para normalizar status legado 'enviado' → 'enviado_brasil'
-- e registrar cada normalização na linha do tempo (china_timeline_eventos).
CREATE OR REPLACE FUNCTION public.rpc_china_normalize_legacy_status()
RETURNS TABLE(submissao_id uuid, produto_codigo text, numero_ordem text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  r record;
BEGIN
  FOR r IN
    UPDATE public.china_produto_submissoes s
       SET status = 'enviado_brasil',
           data_envio = COALESCE(s.data_envio, s.updated_at, v_now),
           updated_at = v_now
     WHERE s.status = 'enviado'
    RETURNING s.id, s.produto_codigo, s.numero_ordem
  LOOP
    INSERT INTO public.china_timeline_eventos (
      kind, title, descricao, payload, submissao_id, produto_codigo, actor_id, dedupe_key
    ) VALUES (
      'submissao_normalizada_legado',
      'Status legado normalizado',
      COALESCE(r.produto_codigo, '—') || ' — enviado → enviado_brasil',
      jsonb_build_object('de', 'enviado', 'para', 'enviado_brasil', 'numero_ordem', r.numero_ordem),
      r.id,
      r.produto_codigo,
      v_actor,
      'sub-normalize-' || r.id || '-' || extract(epoch from v_now)::text
    )
    ON CONFLICT (dedupe_key) DO NOTHING;

    submissao_id := r.id;
    produto_codigo := r.produto_codigo;
    numero_ordem := r.numero_ordem;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_china_normalize_legacy_status() TO authenticated;
