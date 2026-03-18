
-- Create a dedicated category for Tabelas de Preço
INSERT INTO public.sidebar_categories (key, label, icon, ordem)
VALUES ('precos', 'Tabelas de Preço', 'DollarSign', 2)
ON CONFLICT (key) DO NOTHING;

-- Move the precos module from comercial_vendas to the new precos category
-- First delete the old mapping
DELETE FROM public.sidebar_category_modules
WHERE module_code = 'precos'
  AND category_id = (SELECT id FROM public.sidebar_categories WHERE key = 'comercial_vendas');

-- Insert into the new category
INSERT INTO public.sidebar_category_modules (category_id, module_code, ordem)
SELECT id, 'precos', 1
FROM public.sidebar_categories WHERE key = 'precos'
ON CONFLICT (category_id, module_code) DO NOTHING;

-- Shift existing categories ordem to make room (precos at position 2)
UPDATE public.sidebar_categories
SET ordem = ordem + 1
WHERE ordem >= 2 AND key != 'precos';
