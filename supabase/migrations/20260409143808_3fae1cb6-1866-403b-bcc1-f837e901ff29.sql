
-- 1. stitch_templates
CREATE TABLE public.stitch_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  prompt_base TEXT NOT NULL,
  dimensoes TEXT DEFAULT '1080x1080',
  thumbnail_url TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stitch_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active templates"
  ON public.stitch_templates FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage templates"
  ON public.stitch_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Update stitch_designs with versioning, approval, task link
ALTER TABLE public.stitch_designs
  ADD COLUMN IF NOT EXISTS parent_design_id UUID REFERENCES public.stitch_designs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_number INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS tarefa_id UUID;

CREATE INDEX IF NOT EXISTS idx_stitch_designs_parent ON public.stitch_designs(parent_design_id);
CREATE INDEX IF NOT EXISTS idx_stitch_designs_status ON public.stitch_designs(status);

-- 3. stitch_design_comments
CREATE TABLE public.stitch_design_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  design_id UUID NOT NULL REFERENCES public.stitch_designs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stitch_design_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on their designs"
  ON public.stitch_design_comments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.stitch_designs d WHERE d.id = design_id AND d.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Authenticated users can add comments"
  ON public.stitch_design_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.stitch_design_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 4. brand_kits
CREATE TABLE public.brand_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT 'Kit Principal',
  logo_url TEXT,
  cores_primarias TEXT[] DEFAULT '{}',
  cores_secundarias TEXT[] DEFAULT '{}',
  fontes TEXT[] DEFAULT '{}',
  diretrizes_visuais TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brand kits"
  ON public.brand_kits FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_stitch_templates_updated_at
  BEFORE UPDATE ON public.stitch_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brand_kits_updated_at
  BEFORE UPDATE ON public.brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
