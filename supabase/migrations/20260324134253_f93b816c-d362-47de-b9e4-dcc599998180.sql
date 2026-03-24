
CREATE TABLE public.sidebar_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL,
  item_code TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT,
  route TEXT,
  parent_group TEXT,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  label_override TEXT,
  icon_override TEXT,
  screen_code TEXT,
  require_admin BOOLEAN NOT NULL DEFAULT false,
  require_admin_or_supervisor BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(module_code, item_code)
);

ALTER TABLE public.sidebar_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sidebar_menu_items"
  ON public.sidebar_menu_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage sidebar_menu_items"
  ON public.sidebar_menu_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
