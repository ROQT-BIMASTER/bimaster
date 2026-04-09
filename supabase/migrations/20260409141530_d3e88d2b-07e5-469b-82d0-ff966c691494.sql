
-- Table for Google Stitch generated designs
CREATE TABLE public.stitch_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id_stitch TEXT,
  screen_id TEXT,
  prompt TEXT NOT NULL,
  preview_url TEXT,
  html_code TEXT,
  figma_export_url TEXT,
  model_used TEXT DEFAULT 'flash',
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stitch_designs ENABLE ROW LEVEL SECURITY;

-- Users see their own designs
CREATE POLICY "Users can view own stitch designs"
  ON public.stitch_designs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins/supervisors see all
CREATE POLICY "Admins can view all stitch designs"
  ON public.stitch_designs FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'supervisor')
  );

-- Users create their own
CREATE POLICY "Users can create own stitch designs"
  ON public.stitch_designs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users update their own
CREATE POLICY "Users can update own stitch designs"
  ON public.stitch_designs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users delete their own
CREATE POLICY "Users can delete own stitch designs"
  ON public.stitch_designs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_stitch_designs_user_id ON public.stitch_designs(user_id);

-- Timestamp trigger
CREATE TRIGGER update_stitch_designs_updated_at
  BEFORE UPDATE ON public.stitch_designs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
