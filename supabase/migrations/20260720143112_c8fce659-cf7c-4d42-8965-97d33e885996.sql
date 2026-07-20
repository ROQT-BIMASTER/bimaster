
-- Tabela de heartbeat de saúde da sincronização de estoque.
-- Atualizada por trigger em sync_control (independente de haver linhas novas).
CREATE TABLE IF NOT EXISTS public.estoque_sync_health (
  fonte TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_row_count INTEGER,
  last_duration_ms INTEGER,
  last_status TEXT,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.estoque_sync_health TO authenticated;
GRANT ALL ON public.estoque_sync_health TO service_role;

ALTER TABLE public.estoque_sync_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_sync_health_read_authenticated"
  ON public.estoque_sync_health FOR SELECT
  TO authenticated
  USING (true);

-- Trigger: sempre que sync_control receber uma linha de estoque/estoque_live/estoque_fisico,
-- upsertar heartbeat.
CREATE OR REPLACE FUNCTION public.tg_estoque_sync_health_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entidade NOT IN ('estoque','estoque_live','estoque_fisico','estoque_full') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.estoque_sync_health AS h
    (fonte, last_run_at, last_success_at, last_row_count, last_duration_ms, last_status, last_error, updated_at)
  VALUES (
    NEW.entidade,
    NEW.ultima_sync,
    CASE WHEN NEW.status IN ('success','partial') THEN NEW.ultima_sync ELSE NULL END,
    NEW.total_registros,
    NEW.duracao_ms,
    NEW.status,
    NULLIF(NEW.erro_mensagem, ''),
    now()
  )
  ON CONFLICT (fonte) DO UPDATE SET
    last_run_at      = EXCLUDED.last_run_at,
    last_success_at  = COALESCE(EXCLUDED.last_success_at, h.last_success_at),
    last_row_count   = EXCLUDED.last_row_count,
    last_duration_ms = EXCLUDED.last_duration_ms,
    last_status      = EXCLUDED.last_status,
    last_error       = EXCLUDED.last_error,
    updated_at       = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_estoque_sync_health ON public.sync_control;
CREATE TRIGGER trg_estoque_sync_health
  AFTER INSERT ON public.sync_control
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_estoque_sync_health_upsert();

-- Backfill inicial com os últimos registros de sync_control.
INSERT INTO public.estoque_sync_health (fonte, last_run_at, last_success_at, last_row_count, last_duration_ms, last_status, last_error)
SELECT DISTINCT ON (entidade)
  entidade,
  ultima_sync,
  CASE WHEN status IN ('success','partial') THEN ultima_sync ELSE NULL END,
  total_registros,
  duracao_ms,
  status,
  NULLIF(erro_mensagem,'')
FROM public.sync_control
WHERE entidade IN ('estoque','estoque_live','estoque_fisico','estoque_full')
ORDER BY entidade, created_at DESC
ON CONFLICT (fonte) DO NOTHING;

-- Função de checagem de freshness — devolve linhas em atraso e (opcionalmente) grava alerta.
CREATE OR REPLACE FUNCTION public.check_estoque_freshness()
RETURNS TABLE(fonte TEXT, minutos_atraso NUMERIC, ttl_minutos INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ttl JSONB := jsonb_build_object(
    'estoque',       360,  -- 6h (cron 5h + folga)
    'estoque_live',    90, -- 1h (cron 1h + folga)
    'estoque_fisico', 120  -- 2h (webhook)
  );
BEGIN
  RETURN QUERY
  SELECT
    h.fonte,
    ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(h.last_success_at, h.last_run_at))) / 60.0, 1),
    (v_ttl->>h.fonte)::int
  FROM public.estoque_sync_health h
  WHERE v_ttl ? h.fonte
    AND EXTRACT(EPOCH FROM (now() - COALESCE(h.last_success_at, h.last_run_at))) / 60.0
        > (v_ttl->>h.fonte)::int;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_estoque_freshness() TO authenticated;
