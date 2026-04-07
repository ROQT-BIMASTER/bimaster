-- Tabela de logs de classificação automática
CREATE TABLE IF NOT EXISTS public.classification_auto_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_groups INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.classification_auto_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view classification logs"
  ON public.classification_auto_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Service role can insert classification logs"
  ON public.classification_auto_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Habilitar extensões para cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;