
CREATE TABLE IF NOT EXISTS public.cliente_caracteristicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  campo varchar(30) NOT NULL,
  conteudo varchar(60) NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cliente_id, campo)
);

ALTER TABLE public.cliente_caracteristicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.cliente_caracteristicas
  FOR ALL TO service_role USING (true) WITH CHECK (true);
