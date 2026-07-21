
-- Populate sidebar_menu_items.screen_code by joining telas_sistema.rota where possible.
-- Idempotent: only touches rows currently null.
UPDATE public.sidebar_menu_items smi
SET screen_code = ts.codigo,
    updated_at = now()
FROM public.telas_sistema ts
WHERE smi.screen_code IS NULL
  AND smi.ativo
  AND ts.ativo
  AND ts.rota = smi.route
  AND smi.route IS NOT NULL;
