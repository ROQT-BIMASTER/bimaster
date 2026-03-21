
CREATE TABLE IF NOT EXISTS public.tipos_atividade_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(1) NOT NULL UNIQUE,
  descricao varchar(30) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tipos_atividade_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_tipos_atividade"
  ON public.tipos_atividade_empresa FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_tipos_atividade"
  ON public.tipos_atividade_empresa FOR INSERT TO authenticated WITH CHECK (true);
