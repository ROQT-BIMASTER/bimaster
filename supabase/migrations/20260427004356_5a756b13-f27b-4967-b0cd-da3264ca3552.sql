-- RPC para avançar etapa após validação
CREATE OR REPLACE FUNCTION public.avancar_etapa_processo(
  p_instancia_id uuid,
  p_etapa_id uuid,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validacao jsonb;
  v_proxima_etapa_id uuid;
  v_ordem_atual int;
  v_perfil_id uuid;
  v_user uuid := auth.uid();
BEGIN
  -- 1. Valida pendências
  SELECT public.pode_avancar_etapa(p_instancia_id, p_etapa_id) INTO v_validacao;
  IF NOT (v_validacao->>'pode')::boolean THEN
    RETURN jsonb_build_object('success', false, 'pendencias', v_validacao->'pendencias');
  END IF;

  -- 2. Conclui etapa atual
  INSERT INTO public.processo_instancia_etapa_status (instancia_id, etapa_id, status, data_conclusao, aprovada_por, aprovada_em, observacoes)
  VALUES (p_instancia_id, p_etapa_id, 'concluida', now(), v_user, now(), p_observacoes)
  ON CONFLICT (instancia_id, etapa_id) DO UPDATE
    SET status = 'concluida',
        data_conclusao = now(),
        aprovada_por = v_user,
        aprovada_em = now(),
        observacoes = COALESCE(EXCLUDED.observacoes, processo_instancia_etapa_status.observacoes),
        updated_at = now();

  -- 3. Descobre próxima etapa
  SELECT pe.perfil_id, pe.ordem INTO v_perfil_id, v_ordem_atual
  FROM public.processo_perfil_etapas pe WHERE pe.id = p_etapa_id;

  SELECT id INTO v_proxima_etapa_id
  FROM public.processo_perfil_etapas
  WHERE perfil_id = v_perfil_id AND ordem > v_ordem_atual
  ORDER BY ordem ASC
  LIMIT 1;

  -- 4. Atualiza instância
  IF v_proxima_etapa_id IS NULL THEN
    UPDATE public.processo_instancias
    SET status = 'concluida', etapa_atual_id = NULL, data_conclusao = now(), updated_at = now()
    WHERE id = p_instancia_id;
    RETURN jsonb_build_object('success', true, 'concluida', true);
  ELSE
    UPDATE public.processo_instancias
    SET etapa_atual_id = v_proxima_etapa_id, updated_at = now()
    WHERE id = p_instancia_id;
    INSERT INTO public.processo_instancia_etapa_status (instancia_id, etapa_id, status, data_inicio)
    VALUES (p_instancia_id, v_proxima_etapa_id, 'em_andamento', now())
    ON CONFLICT (instancia_id, etapa_id) DO UPDATE SET status='em_andamento', data_inicio=COALESCE(processo_instancia_etapa_status.data_inicio, now());
    RETURN jsonb_build_object('success', true, 'proxima_etapa_id', v_proxima_etapa_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.avancar_etapa_processo(uuid,uuid,text) TO authenticated;