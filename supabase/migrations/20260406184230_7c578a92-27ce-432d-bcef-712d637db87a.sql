
CREATE TABLE public.user_custom_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Meu Dashboard',
  widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_custom_dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dashboards"
ON public.user_custom_dashboards FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own dashboards"
ON public.user_custom_dashboards FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboards"
ON public.user_custom_dashboards FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboards"
ON public.user_custom_dashboards FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_user_custom_dashboards_updated_at
BEFORE UPDATE ON public.user_custom_dashboards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
