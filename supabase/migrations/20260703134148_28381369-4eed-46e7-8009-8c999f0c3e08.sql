
-- Desligar sync Asana

-- 1) Desagendar cron jobs relacionados ao Asana
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobname FROM cron.job WHERE jobname ILIKE 'asana%' OR jobname ILIKE 'sync-asana%' LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;
END $$;

-- 2) Desativar workspaces descobertos
UPDATE public.asana_workspaces_descobertos
  SET ativo = false, auto_descoberta = false, updated_at = now()
  WHERE ativo = true;

-- 3) Feature flag global
INSERT INTO public.feature_flags (codigo, nome, descricao, ativo)
VALUES ('ff_asana_sync', 'Sincronização Asana', 'Controla se a integração com Asana está ativa. Desligada em 2026-07 após envio dos projetos para lixeira.', false)
ON CONFLICT (codigo) DO UPDATE SET ativo = false, updated_at = now();
