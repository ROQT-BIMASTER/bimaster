
CREATE TABLE IF NOT EXISTS public.tipos_anexo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(10) NOT NULL UNIQUE,
  descricao varchar(100) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tipos_anexo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_tipos_anexo"
  ON public.tipos_anexo FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_tipos_anexo"
  ON public.tipos_anexo FOR INSERT TO authenticated WITH CHECK (true);

REVOKE ALL ON public.tipos_anexo FROM anon;
