CREATE TABLE IF NOT EXISTS public.cliente_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cliente_id, tag)
);

ALTER TABLE public.cliente_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.cliente_tags
  FOR ALL TO service_role USING (true) WITH CHECK (true);