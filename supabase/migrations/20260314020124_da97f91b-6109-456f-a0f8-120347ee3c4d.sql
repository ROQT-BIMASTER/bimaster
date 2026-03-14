
-- Custom checklist categories per submission
CREATE TABLE public.china_checklist_custom_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  label_pt text NOT NULL,
  label_cn text DEFAULT '',
  fluxo text NOT NULL DEFAULT 'china_envia' CHECK (fluxo IN ('china_envia', 'brasil_envia')),
  ordem int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Custom checklist items (can belong to a custom category OR a default category)
CREATE TABLE public.china_checklist_custom_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  categoria_custom_id uuid REFERENCES public.china_checklist_custom_categorias(id) ON DELETE CASCADE,
  categoria_default_key text,
  tipo_key text NOT NULL,
  label_pt text NOT NULL,
  label_cn text DEFAULT '',
  accept text,
  multiple boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.china_checklist_custom_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.china_checklist_custom_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage custom checklist categories"
  ON public.china_checklist_custom_categorias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage custom checklist items"
  ON public.china_checklist_custom_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
