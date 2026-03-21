CREATE TABLE IF NOT EXISTS public.paises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(4) NOT NULL UNIQUE,
  descricao varchar(30) NOT NULL,
  codigo_iso varchar(2),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.paises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_paises"
  ON public.paises FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_paises"
  ON public.paises FOR INSERT TO authenticated WITH CHECK (true);