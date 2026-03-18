
-- Sidebar categories (groups of modules)
CREATE TABLE public.sidebar_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'Briefcase',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sidebar module-to-category mapping with overrides
CREATE TABLE public.sidebar_category_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.sidebar_categories(id) ON DELETE CASCADE NOT NULL,
  module_code text NOT NULL,
  label_override text,
  icon_override text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category_id, module_code)
);

-- Enable RLS
ALTER TABLE public.sidebar_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sidebar_category_modules ENABLE ROW LEVEL SECURITY;

-- Everyone can read (menu config is public for authenticated users)
CREATE POLICY "Authenticated users can read sidebar categories"
  ON public.sidebar_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read sidebar modules"
  ON public.sidebar_category_modules FOR SELECT TO authenticated USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage sidebar categories"
  ON public.sidebar_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage sidebar modules"
  ON public.sidebar_category_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed with current configuration
INSERT INTO public.sidebar_categories (key, label, icon, ordem) VALUES
  ('comercial_vendas', 'Comercial & Vendas', 'Briefcase', 1),
  ('trade_marketing', 'Trade & Marketing', 'Store', 2),
  ('producao_qualidade', 'Produção & Qualidade', 'Factory', 3),
  ('financeiro_admin', 'Financeiro & Admin', 'DollarSign', 4),
  ('gestao_projetos', 'Gestão & Projetos', 'FolderKanban', 5);

-- Seed module mappings
INSERT INTO public.sidebar_category_modules (category_id, module_code, ordem)
SELECT c.id, m.module_code, m.ordem
FROM public.sidebar_categories c
CROSS JOIN LATERAL (VALUES
  ('comercial_vendas', 'prospects', 1),
  ('comercial_vendas', 'comercial', 2),
  ('comercial_vendas', 'precos', 3),
  ('trade_marketing', 'trade', 1),
  ('trade_marketing', 'marketing', 2),
  ('trade_marketing', 'eventos', 3),
  ('producao_qualidade', 'fabrica', 1),
  ('producao_qualidade', 'china', 2),
  ('producao_qualidade', 'composicao', 3),
  ('producao_qualidade', 'amostras', 4),
  ('producao_qualidade', 'analise_embalagem', 5),
  ('producao_qualidade', 'etiqueta_bula', 6),
  ('producao_qualidade', 'aprovacao_artes', 7),
  ('financeiro_admin', 'financeiro', 1),
  ('financeiro_admin', 'departamentos', 2),
  ('financeiro_admin', 'estoque', 3),
  ('gestao_projetos', 'projetos', 1),
  ('gestao_projetos', 'reunioes', 2)
) AS m(cat_key, module_code, ordem)
WHERE c.key = m.cat_key;
