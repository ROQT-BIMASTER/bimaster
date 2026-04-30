
REVOKE ALL ON FUNCTION public.sincronizar_bom_edges_from_erp() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalcular_estoque_niveis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_bom_edges_from_erp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_estoque_niveis() TO authenticated;
