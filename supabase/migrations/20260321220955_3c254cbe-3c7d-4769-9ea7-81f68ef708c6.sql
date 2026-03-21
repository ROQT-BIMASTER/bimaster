
CREATE TABLE IF NOT EXISTS public.parcelas_condicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(3) NOT NULL UNIQUE,
  descricao varchar(30) NOT NULL,
  numero_parcelas integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  importado_api boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.parcelas_condicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_parcelas_condicoes"
  ON public.parcelas_condicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_parcelas_condicoes"
  ON public.parcelas_condicoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "service_role_all_parcelas_condicoes"
  ON public.parcelas_condicoes FOR ALL TO service_role USING (true) WITH CHECK (true);
