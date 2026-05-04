
ALTER TABLE public.aprovacao_documento_itens
  ADD COLUMN IF NOT EXISTS revisao_solicitada boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.rpc_solicitar_revisao_item(
  p_item_id uuid,
  p_comentario text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
BEGIN
  SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'item não encontrado'; END IF;
  IF v_item.status <> 'em_andamento' THEN RAISE EXCEPTION 'item não está em andamento'; END IF;
  IF v_item.responsavel_atual_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'apenas o responsável atual pode solicitar revisão';
  END IF;

  UPDATE public.aprovacao_documento_itens
     SET revisao_solicitada = true,
         comentario_atual = COALESCE(p_comentario, comentario_atual),
         responsavel_atual_id = COALESCE(v_item.created_by, v_item.responsavel_atual_id),
         updated_at = now()
   WHERE id = p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_mover_item_coluna(
  p_item_id uuid,
  p_coluna text,
  p_comentario text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_coluna = 'aprovado' THEN
    PERFORM public.rpc_avancar_item_aprovacao(p_item_id, 'aprovado'::text, p_comentario);
  ELSIF p_coluna = 'rejeitado' THEN
    PERFORM public.rpc_avancar_item_aprovacao(p_item_id, 'rejeitado'::text, p_comentario);
  ELSIF p_coluna = 'em_revisao' THEN
    PERFORM public.rpc_solicitar_revisao_item(p_item_id, p_comentario);
  ELSE
    RAISE EXCEPTION 'coluna % não suporta drag-and-drop', p_coluna;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_solicitar_revisao_item(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_solicitar_revisao_item(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_mover_item_coluna(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_mover_item_coluna(uuid, text, text) TO authenticated;
