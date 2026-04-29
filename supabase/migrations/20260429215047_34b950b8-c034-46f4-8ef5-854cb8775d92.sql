-- ============================================================
-- FIX #1: user_roles permission denied
-- RLS está correta, faltam GRANTs base. Sem GRANT, Postgres
-- aborta antes da RLS, produzindo "permission denied" em loop.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- ============================================================
-- FIX #3: Reorder Kanban em batch (1 round-trip)
-- Substitui o loop client-side de N updates por uma RPC única.
-- SECURITY DEFINER + checagem explícita de acesso ao projeto.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reorder_tarefas_secao(
  p_secao_id uuid,
  p_ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_projeto_id uuid;
  v_id uuid;
  v_idx int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT projeto_id INTO v_projeto_id
  FROM public.projeto_secoes
  WHERE id = p_secao_id;

  IF v_projeto_id IS NULL THEN
    RAISE EXCEPTION 'Seção não encontrada';
  END IF;

  IF NOT public.user_can_access_projeto(v_user_id, v_projeto_id) THEN
    RAISE EXCEPTION 'Sem permissão para reordenar tarefas neste projeto';
  END IF;

  -- Atualiza ordem em loop dentro de uma única transação.
  -- Só permite reordenar tarefas que de fato pertençam à seção
  -- (defesa contra IDs forjados).
  FOREACH v_id IN ARRAY p_ordered_ids LOOP
    UPDATE public.projeto_tarefas
       SET ordem = v_idx,
           updated_at = now()
     WHERE id = v_id
       AND secao_id = p_secao_id
       AND excluida_em IS NULL;
    v_idx := v_idx + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_tarefas_secao(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_tarefas_secao(uuid, uuid[]) TO authenticated;