ALTER TABLE public.china_checklist_custom_categorias ADD COLUMN IF NOT EXISTS label_en text DEFAULT '';
ALTER TABLE public.china_checklist_custom_itens      ADD COLUMN IF NOT EXISTS label_en text DEFAULT '';
ALTER TABLE public.china_checklist_cat_overrides     ADD COLUMN IF NOT EXISTS label_en text DEFAULT '';

UPDATE public.china_checklist_custom_categorias SET label_en = COALESCE(NULLIF(label_en,''), label_pt) WHERE label_en IS NULL OR label_en = '';
UPDATE public.china_checklist_custom_itens      SET label_en = COALESCE(NULLIF(label_en,''), label_pt) WHERE label_en IS NULL OR label_en = '';
UPDATE public.china_checklist_cat_overrides     SET label_en = COALESCE(NULLIF(label_en,''), label_pt) WHERE label_en IS NULL OR label_en = '';