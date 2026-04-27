-- ============================================================================
-- Enums
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inbox_caixa') THEN
    CREATE TYPE public.inbox_caixa AS ENUM (
      'acao_minha',
      'atribuida_a_mim',
      'acompanho',
      'delegada_por_mim'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inbox_origem') THEN
    CREATE TYPE public.inbox_origem AS ENUM (
      'projetos',
      'processos',
      'motor_artes',
      'china',
      'aprovacoes',
      'composicao',
      'embalagens',
      'amostras'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inbox_modo_leitura') THEN
    CREATE TYPE public.inbox_modo_leitura AS ENUM ('auto', 'acao');
  END IF;
END$$;

-- ============================================================================
-- Tabela inbox_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inbox_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caixa           inbox_caixa NOT NULL,
  origem          inbox_origem NOT NULL,
  tipo            text NOT NULL,
  modo_leitura    inbox_modo_leitura NOT NULL DEFAULT 'auto',
  titulo          text NOT NULL,
  resumo          text,
  action_url      text,
  referencia_tipo text,
  referencia_id   uuid,
  projeto_id      uuid,
  processo_id     uuid,
  etapa_id        uuid,
  modulo          text,
  emitido_por     uuid,
  lido_em         timestamptz,
  arquivado_em    timestamptz,
  favorito        boolean NOT NULL DEFAULT false,
  snooze_ate      timestamptz,
  resolvido_em    timestamptz,
  resolvido_por   uuid,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Dedup: mesmo destinatário + mesma referência + mesmo tipo
CREATE UNIQUE INDEX IF NOT EXISTS uq_inbox_dedup
  ON public.inbox_items(user_id, referencia_tipo, referencia_id, tipo)
  WHERE referencia_tipo IS NOT NULL AND referencia_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_user_caixa
  ON public.inbox_items(user_id, caixa)
  WHERE arquivado_em IS NULL AND resolvido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_user_origem
  ON public.inbox_items(user_id, origem)
  WHERE arquivado_em IS NULL AND resolvido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_user_modulo
  ON public.inbox_items(user_id, modulo)
  WHERE arquivado_em IS NULL AND resolvido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_snooze
  ON public.inbox_items(user_id, snooze_ate)
  WHERE snooze_ate IS NOT NULL AND resolvido_em IS NULL;

-- updated_at trigger (reusa função padrão do projeto)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inbox_updated_at') THEN
    CREATE TRIGGER trg_inbox_updated_at
      BEFORE UPDATE ON public.inbox_items
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inbox_select_own" ON public.inbox_items;
CREATE POLICY "inbox_select_own"
  ON public.inbox_items FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "inbox_update_own" ON public.inbox_items;
CREATE POLICY "inbox_update_own"
  ON public.inbox_items FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "inbox_delete_own" ON public.inbox_items;
CREATE POLICY "inbox_delete_own"
  ON public.inbox_items FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- INSERT é só via SECURITY DEFINER (inbox_emit). Negar inserts diretos.
DROP POLICY IF EXISTS "inbox_no_direct_insert" ON public.inbox_items;
CREATE POLICY "inbox_no_direct_insert"
  ON public.inbox_items FOR INSERT TO authenticated
  WITH CHECK (false);

-- ============================================================================
-- Funções
-- ============================================================================

-- Emite (insere ou faz "bump" se já existe)
CREATE OR REPLACE FUNCTION public.inbox_emit(
  p_user_id         uuid,
  p_caixa           inbox_caixa,
  p_origem          inbox_origem,
  p_tipo            text,
  p_modo_leitura    inbox_modo_leitura,
  p_titulo          text,
  p_resumo          text DEFAULT NULL,
  p_action_url      text DEFAULT NULL,
  p_referencia_tipo text DEFAULT NULL,
  p_referencia_id   uuid DEFAULT NULL,
  p_projeto_id      uuid DEFAULT NULL,
  p_processo_id     uuid DEFAULT NULL,
  p_etapa_id        uuid DEFAULT NULL,
  p_modulo          text DEFAULT NULL,
  p_emitido_por     uuid DEFAULT NULL,
  p_metadata        jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_accepts boolean;
BEGIN
  -- Respeita preferências de notificação (se a função existir)
  BEGIN
    SELECT public.user_accepts_notification(p_user_id, p_tipo) INTO v_accepts;
  EXCEPTION WHEN undefined_function THEN
    v_accepts := true;
  END;
  IF v_accepts = false THEN
    RETURN NULL;
  END IF;

  IF p_referencia_tipo IS NOT NULL AND p_referencia_id IS NOT NULL THEN
    -- Upsert por dedup
    INSERT INTO public.inbox_items (
      user_id, caixa, origem, tipo, modo_leitura,
      titulo, resumo, action_url,
      referencia_tipo, referencia_id,
      projeto_id, processo_id, etapa_id, modulo,
      emitido_por, metadata
    )
    VALUES (
      p_user_id, p_caixa, p_origem, p_tipo, p_modo_leitura,
      p_titulo, p_resumo, p_action_url,
      p_referencia_tipo, p_referencia_id,
      p_projeto_id, p_processo_id, p_etapa_id, p_modulo,
      p_emitido_por, COALESCE(p_metadata, '{}'::jsonb)
    )
    ON CONFLICT (user_id, referencia_tipo, referencia_id, tipo)
    DO UPDATE SET
      caixa        = EXCLUDED.caixa,
      titulo       = EXCLUDED.titulo,
      resumo       = EXCLUDED.resumo,
      action_url   = EXCLUDED.action_url,
      modo_leitura = EXCLUDED.modo_leitura,
      modulo       = EXCLUDED.modulo,
      metadata     = EXCLUDED.metadata,
      -- Reabre se estava resolvido/arquivado
      lido_em      = NULL,
      arquivado_em = NULL,
      resolvido_em = NULL,
      resolvido_por= NULL,
      snooze_ate   = NULL,
      updated_at   = now()
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.inbox_items (
      user_id, caixa, origem, tipo, modo_leitura,
      titulo, resumo, action_url,
      referencia_tipo, referencia_id,
      projeto_id, processo_id, etapa_id, modulo,
      emitido_por, metadata
    )
    VALUES (
      p_user_id, p_caixa, p_origem, p_tipo, p_modo_leitura,
      p_titulo, p_resumo, p_action_url,
      p_referencia_tipo, p_referencia_id,
      p_projeto_id, p_processo_id, p_etapa_id, p_modulo,
      p_emitido_por, COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Resolver item (chamado quando a ação raiz é feita)
CREATE OR REPLACE FUNCTION public.inbox_resolver_item(
  p_referencia_tipo text,
  p_referencia_id   uuid,
  p_tipo            text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.inbox_items
     SET resolvido_em  = now(),
         resolvido_por = auth.uid(),
         updated_at    = now()
   WHERE referencia_tipo = p_referencia_tipo
     AND referencia_id   = p_referencia_id
     AND (p_tipo IS NULL OR tipo = p_tipo)
     AND resolvido_em IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Marcar como lido em lote
CREATE OR REPLACE FUNCTION public.inbox_marcar_lido_lote(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.inbox_items
     SET lido_em = COALESCE(lido_em, now()),
         updated_at = now()
   WHERE id = ANY(p_ids)
     AND user_id = auth.uid();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Arquivar em lote
CREATE OR REPLACE FUNCTION public.inbox_arquivar_lote(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.inbox_items
     SET arquivado_em = now(),
         updated_at = now()
   WHERE id = ANY(p_ids)
     AND user_id = auth.uid();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Snooze em lote
CREATE OR REPLACE FUNCTION public.inbox_snooze_lote(p_ids uuid[], p_ate timestamptz)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.inbox_items
     SET snooze_ate = p_ate,
         updated_at = now()
   WHERE id = ANY(p_ids)
     AND user_id = auth.uid();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Toggle favorito
CREATE OR REPLACE FUNCTION public.inbox_toggle_favorito(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novo boolean;
BEGIN
  UPDATE public.inbox_items
     SET favorito = NOT favorito,
         updated_at = now()
   WHERE id = p_id
     AND user_id = auth.uid()
  RETURNING favorito INTO v_novo;
  RETURN COALESCE(v_novo, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.inbox_emit(uuid,inbox_caixa,inbox_origem,text,inbox_modo_leitura,text,text,text,text,uuid,uuid,uuid,uuid,text,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_resolver_item(text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_marcar_lido_lote(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_arquivar_lote(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_snooze_lote(uuid[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_toggle_favorito(uuid) TO authenticated;