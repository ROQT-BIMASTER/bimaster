
-- Aceite/recusa de OC pela China
ALTER TABLE public.china_ordens_compra
  ADD COLUMN IF NOT EXISTS aceita_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aceita_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS recusada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recusada_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS motivo_recusa TEXT;

-- RPC: aceitar OC
CREATE OR REPLACE FUNCTION public.rpc_china_aceitar_oc(p_oc_id UUID)
RETURNS public.china_ordens_compra
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.china_ordens_compra;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT (check_user_access(v_uid, 'china') OR is_admin_or_supervisor(v_uid)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.china_ordens_compra
     SET aceita_em = now(),
         aceita_por = v_uid,
         recusada_em = NULL,
         recusada_por = NULL,
         motivo_recusa = NULL,
         status = CASE WHEN status IN ('rascunho','pendente_aprovacao','aguardando_aprovacao','aprovada')
                       THEN 'em_producao' ELSE status END
   WHERE id = p_oc_id
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OC % não encontrada', p_oc_id;
  END IF;
  RETURN v_row;
END;
$$;

-- RPC: recusar OC
CREATE OR REPLACE FUNCTION public.rpc_china_recusar_oc(p_oc_id UUID, p_motivo TEXT)
RETURNS public.china_ordens_compra
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.china_ordens_compra;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT (check_user_access(v_uid, 'china') OR is_admin_or_supervisor(v_uid)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF coalesce(trim(p_motivo),'') = '' THEN
    RAISE EXCEPTION 'motivo obrigatório';
  END IF;

  UPDATE public.china_ordens_compra
     SET recusada_em = now(),
         recusada_por = v_uid,
         motivo_recusa = p_motivo,
         aceita_em = NULL,
         aceita_por = NULL
   WHERE id = p_oc_id
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OC % não encontrada', p_oc_id;
  END IF;
  RETURN v_row;
END;
$$;

-- RPC: confirmar embarque (cria/atualiza china_embarques)
CREATE OR REPLACE FUNCTION public.rpc_china_confirmar_embarque(
  p_oc_id UUID,
  p_numero_container TEXT,
  p_numero_bl TEXT,
  p_data_embarque DATE,
  p_data_eta DATE,
  p_navio TEXT DEFAULT NULL,
  p_porto_origem TEXT DEFAULT NULL,
  p_porto_destino TEXT DEFAULT NULL
)
RETURNS public.china_embarques
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.china_embarques;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (check_user_access(v_uid, 'china') OR is_admin_or_supervisor(v_uid)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.china_embarques (
    ordem_compra_id, numero_container, numero_bl, navio,
    porto_origem, porto_destino, data_embarque, data_eta,
    status, tipo_embarque, created_by
  ) VALUES (
    p_oc_id, p_numero_container, p_numero_bl, p_navio,
    p_porto_origem, p_porto_destino, p_data_embarque, p_data_eta,
    'booked', 'parcial', v_uid
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_china_aceitar_oc(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_china_recusar_oc(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_china_confirmar_embarque(UUID, TEXT, TEXT, DATE, DATE, TEXT, TEXT, TEXT) TO authenticated;
