
CREATE TABLE IF NOT EXISTS public.tipos_entrega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  n_cod_entrega bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  n_cod_transp bigint,
  c_cod_int_entrega varchar(40) UNIQUE,
  c_descricao varchar(80) NOT NULL,
  c_inativo varchar(1) NOT NULL DEFAULT 'N',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tipos_entrega ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_tipos_entrega"
  ON public.tipos_entrega FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_tipos_entrega"
  ON public.tipos_entrega FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_tipos_entrega"
  ON public.tipos_entrega FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated_delete_tipos_entrega"
  ON public.tipos_entrega FOR DELETE TO authenticated USING (true);

REVOKE ALL ON public.tipos_entrega FROM anon;
