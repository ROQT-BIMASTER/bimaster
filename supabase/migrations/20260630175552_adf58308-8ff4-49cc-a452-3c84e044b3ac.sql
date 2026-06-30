CREATE TABLE IF NOT EXISTS public.sync_control_rubysp (
  id                      smallint primary key default 1 check (id = 1),
  solicitar_pedidos_em    timestamptz,
  solicitar_historico_em  timestamptz,
  ultima_exec_pedidos     timestamptz,
  ultima_exec_historico   timestamptz,
  status_pedidos          text,
  status_historico        text,
  updated_at              timestamptz not null default now()
);

INSERT INTO public.sync_control_rubysp (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.sync_control_rubysp TO authenticated;
GRANT ALL    ON public.sync_control_rubysp TO service_role;

ALTER TABLE public.sync_control_rubysp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_ctrl_rsp_sel" ON public.sync_control_rubysp;
CREATE POLICY "sync_ctrl_rsp_sel" ON public.sync_control_rubysp FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_sync_ctrl_rsp_upd ON public.sync_control_rubysp;
CREATE TRIGGER trg_sync_ctrl_rsp_upd BEFORE UPDATE ON public.sync_control_rubysp
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.solicitar_sync_rubysp(p_alvo text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ts timestamptz := now();
BEGIN
  UPDATE public.sync_control_rubysp SET
    solicitar_pedidos_em   = CASE WHEN p_alvo IN ('pedidos','ambos')   THEN ts ELSE solicitar_pedidos_em   END,
    solicitar_historico_em = CASE WHEN p_alvo IN ('historico','ambos') THEN ts ELSE solicitar_historico_em END,
    updated_at = ts
  WHERE id = 1;
  RETURN ts;
END $$;

REVOKE ALL ON FUNCTION public.solicitar_sync_rubysp(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.solicitar_sync_rubysp(text) TO authenticated;