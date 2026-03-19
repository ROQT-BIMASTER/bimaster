
CREATE TABLE public.process_modulos_despacho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'file-text',
  color TEXT NOT NULL DEFAULT 'text-primary',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_modulos_despacho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read modules"
  ON public.process_modulos_despacho FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins and Projetos gerente can insert modules"
  ON public.process_modulos_despacho FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'gerente')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.departamento_id = '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'
      )
    )
  );

CREATE POLICY "Admins and Projetos gerente can update modules"
  ON public.process_modulos_despacho FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'gerente')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.departamento_id = '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'
      )
    )
  );

CREATE POLICY "Admins can delete modules"
  ON public.process_modulos_despacho FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.process_modulos_despacho (key, label, icon_name, color, ordem) VALUES
  ('composicao', 'Composição INCI', 'flask-conical', 'text-primary', 1),
  ('regulatorio', 'Regulatório', 'shield-check', 'text-primary', 2),
  ('qualidade', 'Qualidade', 'check-circle-2', 'text-success', 3),
  ('fluxo_artes', 'Motor de Artes', 'palette', 'text-accent-foreground', 4),
  ('embalagem', 'Embalagem', 'package', 'text-primary', 5),
  ('etiqueta_bula', 'Etiqueta / Bula', 'tag', 'text-primary', 6),
  ('cadastro', 'Cadastro', 'clipboard-list', 'text-primary', 7),
  ('logistica', 'Logística', 'truck', 'text-primary', 8);
