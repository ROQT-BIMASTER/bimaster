-- 1) Move the last orphan item out of em_desenvolvimento into the real admin module.
UPDATE public.sidebar_menu_items
   SET module_code = 'configuracoes',
       parent_group = 'Administração',
       require_admin = TRUE,
       updated_at = now()
 WHERE module_code = 'em_desenvolvimento'
   AND item_code = 'admin_solicitacoes_acesso';

-- 2) Enforce: any future row inserted into em_desenvolvimento MUST be admin-only.
ALTER TABLE public.sidebar_menu_items
  DROP CONSTRAINT IF EXISTS sidebar_menu_items_em_desenvolvimento_admin_only;
ALTER TABLE public.sidebar_menu_items
  ADD CONSTRAINT sidebar_menu_items_em_desenvolvimento_admin_only
  CHECK (module_code <> 'em_desenvolvimento' OR require_admin = TRUE);

-- 3) Guarantee the category/module rows (if they exist) stay inactive.
UPDATE public.sidebar_categories
   SET ativo = FALSE
 WHERE key = 'em_desenvolvimento';

UPDATE public.sidebar_category_modules
   SET ativo = FALSE
 WHERE module_code = 'em_desenvolvimento';

UPDATE public.modulos_sistema
   SET ativo = FALSE
 WHERE codigo = 'em_desenvolvimento';