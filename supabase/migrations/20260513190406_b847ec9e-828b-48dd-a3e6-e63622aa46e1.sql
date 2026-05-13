
-- =============================================================
-- CHAT CORPORATIVO — ONDA 1 (schema + RLS + RPCs + storage)
-- =============================================================

-- 1) CONVERSAS — colunas novas
ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS criado_por uuid,
  ADD COLUMN IF NOT EXISTS arquivada_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_mensagem_em timestamptz;

-- 2) PARTICIPANTES — colunas novas
ALTER TABLE public.conversas_participantes
  ADD COLUMN IF NOT EXISTS papel text NOT NULL DEFAULT 'membro',
  ADD COLUMN IF NOT EXISTS entrou_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS saiu_em timestamptz,
  ADD COLUMN IF NOT EXISTS favorita boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS silenciada_ate timestamptz,
  ADD COLUMN IF NOT EXISTS notificacoes_on boolean NOT NULL DEFAULT true;

-- garante unicidade conversa+usuario
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversas_participantes_conversa_user_uniq'
  ) THEN
    ALTER TABLE public.conversas_participantes
      ADD CONSTRAINT conversas_participantes_conversa_user_uniq UNIQUE (conversa_id, usuario_id);
  END IF;
END $$;

-- 3) MENSAGENS — colunas novas
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'texto',
  ADD COLUMN IF NOT EXISTS responde_a_id uuid REFERENCES public.mensagens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS encaminhada_de_id uuid REFERENCES public.mensagens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS editada_em timestamptz,
  ADD COLUMN IF NOT EXISTS excluida_em timestamptz,
  ADD COLUMN IF NOT EXISTS excluida_para_todos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fixada_em timestamptz,
  ADD COLUMN IF NOT EXISTS fixada_por uuid,
  ADD COLUMN IF NOT EXISTS mencoes uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_created
  ON public.mensagens (conversa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_remetente
  ON public.mensagens (remetente_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_responde_a
  ON public.mensagens (responde_a_id);

-- 4) ANEXOS
CREATE TABLE IF NOT EXISTS public.mensagens_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid NOT NULL REFERENCES public.mensagens(id) ON DELETE CASCADE,
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  width int,
  height int,
  duration_ms int,
  thumbnail_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mensagens_anexos_msg ON public.mensagens_anexos(mensagem_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_anexos_conversa ON public.mensagens_anexos(conversa_id);

-- 5) LEITURAS
CREATE TABLE IF NOT EXISTS public.mensagens_leituras (
  mensagem_id uuid NOT NULL REFERENCES public.mensagens(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  lida_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mensagem_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_mensagens_leituras_user_conv
  ON public.mensagens_leituras (user_id, conversa_id);

-- 6) REACOES
CREATE TABLE IF NOT EXISTS public.mensagens_reacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid NOT NULL REFERENCES public.mensagens(id) ON DELETE CASCADE,
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_mensagens_reacoes_msg ON public.mensagens_reacoes(mensagem_id);

-- 7) FAVORITAS
CREATE TABLE IF NOT EXISTS public.mensagens_favoritas (
  user_id uuid NOT NULL,
  mensagem_id uuid NOT NULL REFERENCES public.mensagens(id) ON DELETE CASCADE,
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mensagem_id)
);

-- 8) OCULTAS (excluir para mim)
CREATE TABLE IF NOT EXISTS public.mensagens_ocultas (
  user_id uuid NOT NULL,
  mensagem_id uuid NOT NULL REFERENCES public.mensagens(id) ON DELETE CASCADE,
  oculta_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mensagem_id)
);

-- 9) PREFERENCIAS
CREATE TABLE IF NOT EXISTS public.chat_preferencias (
  user_id uuid PRIMARY KEY,
  som boolean NOT NULL DEFAULT true,
  push boolean NOT NULL DEFAULT true,
  preview boolean NOT NULL DEFAULT true,
  tema text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- HABILITA RLS
-- =============================================================
ALTER TABLE public.mensagens_anexos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_leituras   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_reacoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_favoritas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_ocultas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_preferencias    ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- POLICIES (semi-joins, sem funções pesadas)
-- =============================================================

-- helper: participante ativo?
-- Usaremos EXISTS inline para perf.

-- ANEXOS
DROP POLICY IF EXISTS chat_anexos_select ON public.mensagens_anexos;
CREATE POLICY chat_anexos_select ON public.mensagens_anexos FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.conversas_participantes cp
  WHERE cp.conversa_id = mensagens_anexos.conversa_id
    AND cp.usuario_id = auth.uid() AND cp.saiu_em IS NULL
));
DROP POLICY IF EXISTS chat_anexos_insert ON public.mensagens_anexos;
CREATE POLICY chat_anexos_insert ON public.mensagens_anexos FOR INSERT TO authenticated
WITH CHECK (uploader_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.conversas_participantes cp
  WHERE cp.conversa_id = mensagens_anexos.conversa_id
    AND cp.usuario_id = auth.uid() AND cp.saiu_em IS NULL
));
DROP POLICY IF EXISTS chat_anexos_delete ON public.mensagens_anexos;
CREATE POLICY chat_anexos_delete ON public.mensagens_anexos FOR DELETE TO authenticated
USING (uploader_id = auth.uid());

-- LEITURAS
DROP POLICY IF EXISTS chat_leituras_select ON public.mensagens_leituras;
CREATE POLICY chat_leituras_select ON public.mensagens_leituras FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.conversas_participantes cp
  WHERE cp.conversa_id = mensagens_leituras.conversa_id
    AND cp.usuario_id = auth.uid() AND cp.saiu_em IS NULL
));
DROP POLICY IF EXISTS chat_leituras_insert ON public.mensagens_leituras;
CREATE POLICY chat_leituras_insert ON public.mensagens_leituras FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.conversas_participantes cp
  WHERE cp.conversa_id = mensagens_leituras.conversa_id
    AND cp.usuario_id = auth.uid() AND cp.saiu_em IS NULL
));

-- REACOES
DROP POLICY IF EXISTS chat_reacoes_select ON public.mensagens_reacoes;
CREATE POLICY chat_reacoes_select ON public.mensagens_reacoes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.conversas_participantes cp
  WHERE cp.conversa_id = mensagens_reacoes.conversa_id
    AND cp.usuario_id = auth.uid() AND cp.saiu_em IS NULL
));
DROP POLICY IF EXISTS chat_reacoes_insert ON public.mensagens_reacoes;
CREATE POLICY chat_reacoes_insert ON public.mensagens_reacoes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.conversas_participantes cp
  WHERE cp.conversa_id = mensagens_reacoes.conversa_id
    AND cp.usuario_id = auth.uid() AND cp.saiu_em IS NULL
));
DROP POLICY IF EXISTS chat_reacoes_delete ON public.mensagens_reacoes;
CREATE POLICY chat_reacoes_delete ON public.mensagens_reacoes FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- FAVORITAS
DROP POLICY IF EXISTS chat_favoritas_all ON public.mensagens_favoritas;
CREATE POLICY chat_favoritas_all ON public.mensagens_favoritas FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- OCULTAS
DROP POLICY IF EXISTS chat_ocultas_all ON public.mensagens_ocultas;
CREATE POLICY chat_ocultas_all ON public.mensagens_ocultas FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- PREFERENCIAS
DROP POLICY IF EXISTS chat_pref_all ON public.chat_preferencias;
CREATE POLICY chat_pref_all ON public.chat_preferencias FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================
-- TRIGGER: atualizar conversas.ultima_mensagem_em
-- =============================================================
CREATE OR REPLACE FUNCTION public.tg_chat_atualiza_ultima_msg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversas
     SET ultima_mensagem_em = NEW.created_at,
         updated_at = NEW.created_at
   WHERE id = NEW.conversa_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_chat_ultima_msg ON public.mensagens;
CREATE TRIGGER trg_chat_ultima_msg
AFTER INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.tg_chat_atualiza_ultima_msg();

-- =============================================================
-- RPCs
-- =============================================================

-- Cria grupo e adiciona participantes; criador vira admin
CREATE OR REPLACE FUNCTION public.rpc_chat_criar_grupo(
  p_nome text,
  p_descricao text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_participantes uuid[] DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_conversa_id uuid;
  v_user uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF coalesce(trim(p_nome),'') = '' THEN RAISE EXCEPTION 'nome obrigatório'; END IF;

  INSERT INTO public.conversas (nome, tipo, descricao, avatar_url, criado_por)
  VALUES (p_nome, 'group', p_descricao, p_avatar_url, v_uid)
  RETURNING id INTO v_conversa_id;

  -- criador como admin
  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  VALUES (v_conversa_id, v_uid, 'admin')
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  -- demais participantes
  FOREACH v_user IN ARRAY coalesce(p_participantes, '{}'::uuid[]) LOOP
    IF v_user IS NOT NULL AND v_user <> v_uid THEN
      INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
      VALUES (v_conversa_id, v_user, 'membro')
      ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conversa_id;
END $$;

-- Adiciona participantes (apenas admin)
CREATE OR REPLACE FUNCTION public.rpc_chat_adicionar_participantes(
  p_conversa_id uuid,
  p_users uuid[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_user uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes
     WHERE conversa_id = p_conversa_id AND usuario_id = v_uid
       AND papel = 'admin' AND saiu_em IS NULL
  ) THEN RAISE EXCEPTION 'apenas admin'; END IF;

  FOREACH v_user IN ARRAY coalesce(p_users, '{}'::uuid[]) LOOP
    IF v_user IS NOT NULL THEN
      INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
      VALUES (p_conversa_id, v_user, 'membro')
      ON CONFLICT (conversa_id, usuario_id) DO UPDATE
        SET saiu_em = NULL, entrou_em = now();
    END IF;
  END LOOP;
END $$;

-- Remove participante (admin)
CREATE OR REPLACE FUNCTION public.rpc_chat_remover_participante(
  p_conversa_id uuid,
  p_user uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes
     WHERE conversa_id = p_conversa_id AND usuario_id = v_uid
       AND papel = 'admin' AND saiu_em IS NULL
  ) THEN RAISE EXCEPTION 'apenas admin'; END IF;

  UPDATE public.conversas_participantes
     SET saiu_em = now()
   WHERE conversa_id = p_conversa_id AND usuario_id = p_user;
END $$;

-- Promover admin
CREATE OR REPLACE FUNCTION public.rpc_chat_promover_admin(
  p_conversa_id uuid,
  p_user uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes
     WHERE conversa_id = p_conversa_id AND usuario_id = v_uid
       AND papel = 'admin' AND saiu_em IS NULL
  ) THEN RAISE EXCEPTION 'apenas admin'; END IF;

  UPDATE public.conversas_participantes
     SET papel = 'admin'
   WHERE conversa_id = p_conversa_id AND usuario_id = p_user;
END $$;

-- Sair do grupo
CREATE OR REPLACE FUNCTION public.rpc_chat_sair_grupo(p_conversa_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  UPDATE public.conversas_participantes
     SET saiu_em = now()
   WHERE conversa_id = p_conversa_id AND usuario_id = v_uid;
END $$;

-- Marcar lido em lote (até uma mensagem)
CREATE OR REPLACE FUNCTION public.rpc_chat_marcar_lido(
  p_conversa_id uuid,
  p_ate_mensagem_id uuid DEFAULT NULL
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_corte timestamptz;
  v_count int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes
     WHERE conversa_id = p_conversa_id AND usuario_id = v_uid AND saiu_em IS NULL
  ) THEN RAISE EXCEPTION 'sem acesso'; END IF;

  IF p_ate_mensagem_id IS NOT NULL THEN
    SELECT created_at INTO v_corte FROM public.mensagens WHERE id = p_ate_mensagem_id;
  ELSE
    v_corte := now();
  END IF;

  WITH ins AS (
    INSERT INTO public.mensagens_leituras (mensagem_id, user_id, conversa_id)
    SELECT m.id, v_uid, m.conversa_id
      FROM public.mensagens m
     WHERE m.conversa_id = p_conversa_id
       AND m.created_at <= v_corte
       AND m.remetente_id <> v_uid
       AND NOT EXISTS (
         SELECT 1 FROM public.mensagens_leituras l
          WHERE l.mensagem_id = m.id AND l.user_id = v_uid
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;

  UPDATE public.conversas_participantes
     SET ultima_leitura = v_corte
   WHERE conversa_id = p_conversa_id AND usuario_id = v_uid;

  RETURN v_count;
END $$;

-- =============================================================
-- STORAGE: bucket privado para anexos do chat
-- =============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-anexos', 'chat-anexos', false, 20971520)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

-- Path: <conversa_id>/<uid>/<msg_id>/<arquivo>
DROP POLICY IF EXISTS chat_anexos_storage_select ON storage.objects;
CREATE POLICY chat_anexos_storage_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-anexos'
  AND EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id::text = (storage.foldername(name))[1]
      AND cp.usuario_id = auth.uid()
      AND cp.saiu_em IS NULL
  )
);

DROP POLICY IF EXISTS chat_anexos_storage_insert ON storage.objects;
CREATE POLICY chat_anexos_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-anexos'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id::text = (storage.foldername(name))[1]
      AND cp.usuario_id = auth.uid()
      AND cp.saiu_em IS NULL
  )
);

DROP POLICY IF EXISTS chat_anexos_storage_delete ON storage.objects;
CREATE POLICY chat_anexos_storage_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-anexos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- =============================================================
-- REALTIME
-- =============================================================
ALTER TABLE public.mensagens REPLICA IDENTITY FULL;
ALTER TABLE public.mensagens_leituras REPLICA IDENTITY FULL;
ALTER TABLE public.mensagens_reacoes REPLICA IDENTITY FULL;
ALTER TABLE public.mensagens_anexos REPLICA IDENTITY FULL;
ALTER TABLE public.conversas_participantes REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_leituras; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_reacoes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_anexos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas_participantes; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
