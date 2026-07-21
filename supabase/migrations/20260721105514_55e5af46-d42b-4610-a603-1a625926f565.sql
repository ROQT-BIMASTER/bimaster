
-- Fallback: para itens ainda sem screen_code, usar uma tela representativa do
-- mesmo módulo (a de menor código, determinístico). Não sobrescreve os já preenchidos.
UPDATE public.sidebar_menu_items smi
SET screen_code = sub.codigo,
    updated_at = now()
FROM (
  SELECT modulo_codigo, MIN(codigo) AS codigo
  FROM public.telas_sistema
  WHERE ativo
  GROUP BY modulo_codigo
) sub
WHERE smi.screen_code IS NULL
  AND smi.ativo
  AND smi.module_code = sub.modulo_codigo
  AND NOT smi.require_admin
  AND NOT smi.require_admin_or_supervisor;
