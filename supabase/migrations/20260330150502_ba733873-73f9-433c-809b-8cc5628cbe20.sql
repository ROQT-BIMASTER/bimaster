
-- Vinculação de banners e materiais a formulários
CREATE TABLE public.dynamic_form_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.dynamic_forms(id) ON DELETE CASCADE NOT NULL,
  attachment_type TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Compartilhamento de resultados com outros usuários
CREATE TABLE public.dynamic_form_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.dynamic_forms(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES auth.users(id) NOT NULL,
  shared_with UUID REFERENCES auth.users(id) NOT NULL,
  permission TEXT DEFAULT 'view',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(form_id, shared_with)
);

ALTER TABLE public.dynamic_form_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_form_shares ENABLE ROW LEVEL SECURITY;

-- Attachments: owner do form pode gerenciar
CREATE POLICY "Owner can manage attachments" ON public.dynamic_form_attachments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.dynamic_forms f WHERE f.id = form_id AND f.created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.dynamic_forms f WHERE f.id = form_id AND f.created_by = auth.uid())
  );

-- Attachments: leitura pública para renderização
CREATE POLICY "Anyone can read attachments" ON public.dynamic_form_attachments
  FOR SELECT TO anon, authenticated
  USING (true);

-- Shares: owner do form pode gerenciar compartilhamentos
CREATE POLICY "Owner can manage shares" ON public.dynamic_form_shares
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.dynamic_forms f WHERE f.id = form_id AND f.created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.dynamic_forms f WHERE f.id = form_id AND f.created_by = auth.uid())
  );

-- Shares: usuário compartilhado pode ler
CREATE POLICY "Shared user can read share" ON public.dynamic_form_shares
  FOR SELECT TO authenticated
  USING (shared_with = auth.uid());
