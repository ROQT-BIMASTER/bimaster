
CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_excluir(
  p_fila_id uuid,
  p_hard boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_tickets_count integer;
  v_fila RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT public.has_role(v_uid, 'admin'::public.app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'forbidden: apenas administradores podem excluir departamentos' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_fila FROM public.suporte_filas WHERE id = p_fila_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fila_nao_encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::int INTO v_tickets_count
    FROM public.suporte_tickets
   WHERE fila_id = p_fila_id;

  IF p_hard THEN
    IF v_tickets_count > 0 THEN
      RAISE EXCEPTION 'fila_com_tickets: existem % chamados vinculados; use exclusão suave', v_tickets_count
        USING ERRCODE = 'P0001';
    END IF;

    -- Remove vínculos leves antes de apagar a fila.
    DELETE FROM public.suporte_fila_agentes WHERE fila_id = p_fila_id;
    DELETE FROM public.suporte_filas WHERE id = p_fila_id;

    RETURN jsonb_build_object(
      'ok', true,
      'modo', 'hard',
      'fila_id', p_fila_id,
      'nome', v_fila.nome
    );
  END IF;

  -- Soft delete: marca como inativa, não aceita mais chamados e some das listas.
  UPDATE public.suporte_filas
     SET ativo = false,
         aceita_chamados = false,
         updated_at = now()
   WHERE id = p_fila_id;

  RETURN jsonb_build_object(
    'ok', true,
    'modo', 'soft',
    'fila_id', p_fila_id,
    'nome', v_fila.nome,
    'tickets', v_tickets_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_suporte_fila_excluir(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_suporte_fila_excluir(uuid, boolean) TO authenticated;
