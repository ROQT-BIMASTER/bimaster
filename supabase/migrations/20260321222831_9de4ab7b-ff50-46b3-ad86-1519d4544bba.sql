CREATE TABLE IF NOT EXISTS public.cnaes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(7) NOT NULL UNIQUE,
  descricao varchar(200) NOT NULL,
  estrutura varchar(10),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cnaes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_cnaes"
  ON public.cnaes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_cnaes"
  ON public.cnaes FOR INSERT TO authenticated WITH CHECK (true);