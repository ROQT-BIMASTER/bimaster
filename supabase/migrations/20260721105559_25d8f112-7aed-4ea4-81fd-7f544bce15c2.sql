
UPDATE public.sidebar_menu_items
SET screen_code = 'fornecedor_vendas', updated_at = now()
WHERE screen_code IS NULL
  AND ativo
  AND module_code IN ('fornecedor_vendas','fornecedor_vendas_result');
