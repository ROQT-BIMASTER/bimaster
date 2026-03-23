CREATE TABLE IF NOT EXISTS public.config_fornecedor_visibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  modulo text NOT NULL DEFAULT 'contas_pagar',
  visibilidade text NOT NULL DEFAULT 'todas',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(empresa_id, modulo)
);

ALTER TABLE public.config_fornecedor_visibilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read visibility config"
  ON public.config_fornecedor_visibilidade
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage visibility config"
  ON public.config_fornecedor_visibilidade
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );