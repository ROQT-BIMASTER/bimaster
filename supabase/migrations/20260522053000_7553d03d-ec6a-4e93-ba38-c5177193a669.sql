
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.rpc_padronizar_insumo_duplicado(
  _codigos_origem text[],
  _fornecedor_origem text,
  _codigo_canonico text,
  _nome_canonico text,
  _vincular_mp boolean DEFAULT true
)
RETURNS TABLE(linhas_atualizadas int, mp_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mp_id uuid;
  v_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF _codigo_canonico IS NULL OR length(trim(_codigo_canonico)) = 0 THEN
    RAISE EXCEPTION 'codigo_canonico obrigatorio';
  END IF;
  IF _nome_canonico IS NULL OR length(trim(_nome_canonico)) = 0 THEN
    RAISE EXCEPTION 'nome_canonico obrigatorio';
  END IF;

  IF _vincular_mp THEN
    INSERT INTO public.fabrica_materias_primas (codigo, nome)
    VALUES (_codigo_canonico, _nome_canonico)
    ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, updated_at = now()
    RETURNING id INTO v_mp_id;
  END IF;

  WITH upd AS (
    UPDATE public.fabrica_produto_custos pc
       SET codigo = _codigo_canonico,
           nome   = _nome_canonico,
           mp_id  = COALESCE(v_mp_id, pc.mp_id),
           codigo_fornecedor = COALESCE(NULLIF(pc.codigo_fornecedor, ''), pc.codigo),
           updated_at = now()
     WHERE pc.codigo = ANY(_codigos_origem)
       AND lower(unaccent(coalesce(pc.fornecedor,''))) = lower(unaccent(coalesce(_fornecedor_origem,'')))
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM upd;

  RETURN QUERY SELECT v_count, v_mp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_padronizar_insumo_duplicado(text[], text, text, text, boolean) TO authenticated;
