
-- 1. Coluna briefing_id em instâncias
ALTER TABLE public.fluxo_aprovacao_instancias
  ADD COLUMN IF NOT EXISTS briefing_id uuid REFERENCES public.briefings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_fluxo_inst_briefing
  ON public.fluxo_aprovacao_instancias(briefing_id);

-- 2. Política adicional: dono do briefing pode SELECT/INSERT/UPDATE instâncias vinculadas
DROP POLICY IF EXISTS "Briefing owner can view instances" ON public.fluxo_aprovacao_instancias;
CREATE POLICY "Briefing owner can view instances"
  ON public.fluxo_aprovacao_instancias
  FOR SELECT
  TO authenticated
  USING (
    briefing_id IS NOT NULL
    AND briefing_id IN (SELECT id FROM public.briefings WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Briefing owner can insert briefing instances" ON public.fluxo_aprovacao_instancias;
CREATE POLICY "Briefing owner can insert briefing instances"
  ON public.fluxo_aprovacao_instancias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND briefing_id IS NOT NULL
    AND briefing_id IN (SELECT id FROM public.briefings WHERE user_id = auth.uid())
  );

-- Aprovadores: dono do briefing pode ver
DROP POLICY IF EXISTS "Briefing owner views approvers" ON public.fluxo_aprovacao_aprovadores;
CREATE POLICY "Briefing owner views approvers"
  ON public.fluxo_aprovacao_aprovadores
  FOR SELECT
  TO authenticated
  USING (
    instancia_id IN (
      SELECT fai.id FROM public.fluxo_aprovacao_instancias fai
      JOIN public.briefings b ON b.id = fai.briefing_id
      WHERE b.user_id = auth.uid()
    )
  );

-- 3. RPC para criar lote de aprovação a partir de briefing
CREATE OR REPLACE FUNCTION public.rpc_criar_lote_aprovacao_briefing(
  p_briefing_id uuid,
  p_config_id uuid,
  p_titulo text DEFAULT NULL,
  p_prazo date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instancia_id uuid;
  v_user_id uuid := auth.uid();
  v_etapa RECORD;
  v_titulo text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Verifica que o usuário é dono do briefing (ou admin)
  IF NOT EXISTS (
    SELECT 1 FROM public.briefings
    WHERE id = p_briefing_id
      AND (user_id = v_user_id OR public.has_role(v_user_id, 'admin'::app_role))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para enviar este briefing para aprovação';
  END IF;

  -- Verifica que a config existe
  IF NOT EXISTS (SELECT 1 FROM public.fluxo_aprovacao_config WHERE id = p_config_id AND ativo = true) THEN
    RAISE EXCEPTION 'Fluxo de aprovação inválido ou inativo';
  END IF;

  -- Título do lote
  v_titulo := COALESCE(p_titulo, (SELECT titulo FROM public.briefings WHERE id = p_briefing_id));

  -- Cria instância
  INSERT INTO public.fluxo_aprovacao_instancias (
    config_id, briefing_id, etapa_atual_ordem, status, rodada,
    created_by, titulo, lote_nome, prazo_lote, politica_movimentacao
  )
  VALUES (
    p_config_id, p_briefing_id, 0, 'pendente', 1,
    v_user_id, v_titulo, v_titulo, p_prazo, 'continuar'
  )
  RETURNING id INTO v_instancia_id;

  -- Copia etapas como aprovadores pendentes
  FOR v_etapa IN
    SELECT id, responsavel_id, responsavel_secundario_id
    FROM public.fluxo_aprovacao_etapas
    WHERE config_id = p_config_id AND ativo = true
    ORDER BY ordem
  LOOP
    IF v_etapa.responsavel_id IS NOT NULL THEN
      INSERT INTO public.fluxo_aprovacao_aprovadores (
        instancia_id, etapa_id, responsavel_tipo, usuario_id, status
      ) VALUES (
        v_instancia_id, v_etapa.id, 'especifico', v_etapa.responsavel_id, 'pendente'
      );
    END IF;
    IF v_etapa.responsavel_secundario_id IS NOT NULL THEN
      INSERT INTO public.fluxo_aprovacao_aprovadores (
        instancia_id, etapa_id, responsavel_tipo, usuario_id, status
      ) VALUES (
        v_instancia_id, v_etapa.id, 'especifico', v_etapa.responsavel_secundario_id, 'pendente'
      );
    END IF;
  END LOOP;

  -- Atualiza status do briefing
  UPDATE public.briefings
  SET status = 'em_aprovacao', updated_at = now()
  WHERE id = p_briefing_id;

  RETURN v_instancia_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_criar_lote_aprovacao_briefing(uuid, uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_criar_lote_aprovacao_briefing(uuid, uuid, text, date) TO authenticated, service_role;

-- 4. Cancelar aprovação (volta para em_andamento)
CREATE OR REPLACE FUNCTION public.rpc_cancelar_aprovacao_briefing(p_briefing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.briefings
    WHERE id = p_briefing_id
      AND (user_id = v_user_id OR public.has_role(v_user_id, 'admin'::app_role))
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.fluxo_aprovacao_instancias
  SET status = 'cancelado', updated_at = now()
  WHERE briefing_id = p_briefing_id AND status = 'pendente';

  UPDATE public.briefings
  SET status = 'em_andamento', updated_at = now()
  WHERE id = p_briefing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cancelar_aprovacao_briefing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_aprovacao_briefing(uuid) TO authenticated, service_role;
