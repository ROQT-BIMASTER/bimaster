-- ============================================================================
-- BLOCO 01 - mensagens_traducoes
-- ============================================================================
DO $mig$ BEGIN RAISE NOTICE '>>> [01/10] mensagens_traducoes'; END $mig$;

CREATE TABLE IF NOT EXISTS public.mensagens_traducoes (
  mensagem_id uuid NOT NULL REFERENCES public.mensagens(id) ON DELETE CASCADE,
  idioma text NOT NULL CHECK (idioma IN ('pt', 'en', 'cn')),
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mensagem_id, idioma)
);

CREATE INDEX IF NOT EXISTS idx_mensagens_traducoes_mensagem
  ON public.mensagens_traducoes (mensagem_id);

ALTER TABLE public.mensagens_traducoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_traducoes_select ON public.mensagens_traducoes;
CREATE POLICY chat_traducoes_select ON public.mensagens_traducoes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.mensagens m
    JOIN public.conversas_participantes cp ON cp.conversa_id = m.conversa_id
    WHERE m.id = mensagens_traducoes.mensagem_id
      AND cp.usuario_id = auth.uid()
      AND cp.saiu_em IS NULL
  )
);

COMMENT ON TABLE public.mensagens_traducoes IS
  'Cache de traducoes sob demanda do chat corporativo. Populado pela edge function chat-traducao. RLS de leitura espelha conversas_participantes.';

-- ============================================================================
-- BLOCO 02 - rpc_china_promover_anexo_ao_checklist
-- ============================================================================
DO $mig$ BEGIN RAISE NOTICE '>>> [02/10] rpc_china_promover_anexo_ao_checklist'; END $mig$;

CREATE OR REPLACE FUNCTION public.rpc_china_promover_anexo_ao_checklist(
  p_mensagem_id        uuid,
  p_anexo_path         text,
  p_tipo_documento     text,
  p_novo_arquivo_path  text,
  p_novo_nome_arquivo  text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_uid           uuid := auth.uid();
  v_submissao_id  uuid;
  v_anexos        jsonb;
  v_doc_id        uuid;
  v_user_nome     text;
  v_user_tipo     text;
  v_anexos_novo   jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_mensagem_id IS NULL OR p_anexo_path IS NULL OR p_tipo_documento IS NULL
     OR p_novo_arquivo_path IS NULL OR p_novo_nome_arquivo IS NULL THEN
    RAISE EXCEPTION 'parametros obrigatorios ausentes';
  END IF;

  SELECT submissao_id, COALESCE(anexos, '[]'::jsonb)
    INTO v_submissao_id, v_anexos
  FROM china_chat_mensagens
  WHERE id = p_mensagem_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'mensagem nao encontrada'; END IF;

  INSERT INTO china_produto_documentos (
    submissao_id, tipo_documento, arquivo_path, nome_arquivo, status
  ) VALUES (
    v_submissao_id, p_tipo_documento, p_novo_arquivo_path, p_novo_nome_arquivo, 'enviado'
  )
  RETURNING id INTO v_doc_id;

  SELECT jsonb_agg(
    CASE WHEN a->>'path' = p_anexo_path
      THEN a || jsonb_build_object('promovido_documento_id', v_doc_id::text)
      ELSE a
    END
  )
  INTO v_anexos_novo
  FROM jsonb_array_elements(v_anexos) AS a;

  UPDATE china_chat_mensagens
     SET anexos = COALESCE(v_anexos_novo, '[]'::jsonb)
   WHERE id = p_mensagem_id;

  SELECT
    COALESCE(p.nome, 'Usuario'),
    CASE WHEN lower(COALESCE(d.nome, '')) LIKE '%china%' THEN 'china' ELSE 'brasil' END
  INTO v_user_nome, v_user_tipo
  FROM profiles p
  LEFT JOIN departamentos d ON d.id = p.departamento_id
  WHERE p.id = v_uid;

  v_user_nome := COALESCE(v_user_nome, 'Usuario');
  v_user_tipo := COALESCE(v_user_tipo, 'brasil');

  INSERT INTO china_chat_mensagens (
    submissao_id, usuario_id, usuario_nome, conteudo, tipo,
    ref_tipo, ref_id, ref_label
  ) VALUES (
    v_submissao_id, v_uid, v_user_nome,
    'Promovi o documento *' || p_novo_nome_arquivo || '* ao checklist como **' || p_tipo_documento || '**',
    v_user_tipo, 'documento', v_doc_id::text, p_novo_nome_arquivo
  );

  RETURN v_doc_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.rpc_china_promover_anexo_ao_checklist(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_china_promover_anexo_ao_checklist(uuid, text, text, text, text) TO authenticated;

-- ============================================================================
-- BLOCO 03 - rpc_china_submissoes_unread
-- ============================================================================
DO $mig$ BEGIN RAISE NOTICE '>>> [03/10] rpc_china_submissoes_unread'; END $mig$;

CREATE OR REPLACE FUNCTION public.rpc_china_submissoes_unread()
RETURNS TABLE(submissao_id uuid, total int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  WITH uid AS (SELECT auth.uid() AS id)
  SELECT m.submissao_id, count(*)::int AS total
  FROM public.china_chat_mensagens m, uid
  WHERE uid.id IS NOT NULL
    AND m.usuario_id <> uid.id
    AND NOT (COALESCE(m.lida_por, '[]'::jsonb) @> jsonb_build_array(uid.id::text))
  GROUP BY m.submissao_id;
$fn$;

REVOKE EXECUTE ON FUNCTION public.rpc_china_submissoes_unread() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_china_submissoes_unread() TO authenticated;

-- ============================================================================
-- BLOCO 04 - triggers @ mencao nos 2 chats
-- ============================================================================
DO $mig$ BEGIN RAISE NOTICE '>>> [04/10] triggers de @ mencao'; END $mig$;

CREATE OR REPLACE FUNCTION public.notify_chat_corporativo_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_mentioned     uuid;
  v_autor_nome    text;
  v_conv_nome     text;
  v_conv_tipo     text;
  v_msg           text;
BEGIN
  IF NEW.mencoes IS NULL OR array_length(NEW.mencoes, 1) IS NULL THEN RETURN NEW; END IF;

  SELECT nome INTO v_autor_nome FROM public.profiles WHERE id = NEW.remetente_id LIMIT 1;
  SELECT nome, tipo INTO v_conv_nome, v_conv_tipo
    FROM public.conversas WHERE id = NEW.conversa_id LIMIT 1;

  FOREACH v_mentioned IN ARRAY NEW.mencoes LOOP
    IF v_mentioned IS NULL OR v_mentioned = NEW.remetente_id THEN CONTINUE; END IF;

    v_msg := COALESCE(v_autor_nome, 'Alguem') || ' mencionou voce ' ||
      CASE
        WHEN v_conv_tipo IN ('grupo', 'group') AND v_conv_nome IS NOT NULL
          THEN 'no grupo ' || v_conv_nome
        WHEN v_conv_tipo IN ('grupo', 'group') THEN 'em um grupo'
        ELSE 'em uma conversa'
      END;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (v_mentioned, 'chat_mention', 'Voce foi mencionado no chat', v_msg, '/chat');
  END LOOP;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notify_chat_corporativo_mentions ON public.mensagens;
CREATE TRIGGER trg_notify_chat_corporativo_mentions
AFTER INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.notify_chat_corporativo_mentions();

CREATE OR REPLACE FUNCTION public.notify_china_chat_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_men_item        jsonb;
  v_mentioned_id    uuid;
  v_produto_codigo  text;
  v_produto_nome    text;
  v_msg             text;
BEGIN
  IF NEW.mencoes IS NULL OR jsonb_array_length(NEW.mencoes) = 0 THEN RETURN NEW; END IF;

  SELECT produto_codigo, produto_nome
    INTO v_produto_codigo, v_produto_nome
    FROM public.china_produto_submissoes WHERE id = NEW.submissao_id LIMIT 1;

  FOR v_men_item IN SELECT * FROM jsonb_array_elements(NEW.mencoes) LOOP
    v_mentioned_id := NULL;
    IF jsonb_typeof(v_men_item) = 'object' THEN
      BEGIN v_mentioned_id := (v_men_item->>'user_id')::uuid;
      EXCEPTION WHEN OTHERS THEN v_mentioned_id := NULL; END;
    ELSIF jsonb_typeof(v_men_item) = 'string' THEN
      BEGIN v_mentioned_id := (v_men_item #>> '{}')::uuid;
      EXCEPTION WHEN OTHERS THEN v_mentioned_id := NULL; END;
    END IF;

    IF v_mentioned_id IS NULL OR v_mentioned_id = NEW.usuario_id THEN CONTINUE; END IF;

    v_msg := COALESCE(NEW.usuario_nome, 'Alguem') || ' mencionou voce no chat da submissao' ||
      CASE
        WHEN v_produto_codigo IS NOT NULL
          THEN ' ' || v_produto_codigo || COALESCE(' - ' || v_produto_nome, '')
        ELSE ''
      END;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (v_mentioned_id, 'china_chat_mention', 'Voce foi mencionado no chat China', v_msg, '/chat');
  END LOOP;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notify_china_chat_mentions ON public.china_chat_mensagens;
CREATE TRIGGER trg_notify_china_chat_mentions
AFTER INSERT ON public.china_chat_mensagens
FOR EACH ROW EXECUTE FUNCTION public.notify_china_chat_mentions();

-- ============================================================================
-- BLOCO 05 - busca FTS no chat corporativo
-- ============================================================================
DO $mig$ BEGIN RAISE NOTICE '>>> [05/10] busca FTS chat corporativo'; END $mig$;

ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(conteudo, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_mensagens_search_vector
  ON public.mensagens USING GIN (search_vector);

CREATE OR REPLACE FUNCTION public.rpc_chat_search(
  p_query text,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  id            uuid,
  conversa_id   uuid,
  remetente_id  uuid,
  conteudo      text,
  headline      text,
  tipo          text,
  created_at    timestamptz,
  rank          real
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_q   tsquery;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_query IS NULL OR length(trim(p_query)) < 2 THEN RETURN; END IF;

  v_q := websearch_to_tsquery('portuguese', p_query);

  RETURN QUERY
  SELECT
    m.id, m.conversa_id, m.remetente_id, m.conteudo,
    ts_headline('portuguese', coalesce(m.conteudo, ''), v_q,
      'StartSel=<<,StopSel=>>,MaxFragments=2,MinWords=4,MaxWords=18') AS headline,
    m.tipo, m.created_at, ts_rank(m.search_vector, v_q) AS rank
  FROM public.mensagens m
  JOIN public.conversas_participantes cp
    ON cp.conversa_id = m.conversa_id
   AND cp.usuario_id  = v_uid
   AND cp.saiu_em IS NULL
  WHERE m.search_vector @@ v_q
    AND COALESCE(m.excluida_para_todos, false) = false
  ORDER BY rank DESC, m.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.rpc_chat_search(text, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_chat_search(text, int) TO authenticated;

-- ============================================================================
-- BLOCO 06 - notify_task_deadlines_chat
-- ============================================================================
DO $mig$ BEGIN RAISE NOTICE '>>> [06/10] notify_task_deadlines_chat'; END $mig$;

CREATE OR REPLACE FUNCTION public.notify_task_deadlines_chat()
RETURNS TABLE(projeto_id uuid, postado boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_proj  RECORD;
  v_conteudo TEXT;
  v_ja_existe BOOLEAN;
  v_tem_conteudo BOOLEAN;
BEGIN
  FOR v_proj IN
    SELECT DISTINCT p.id, p.nome
    FROM public.projetos p
    JOIN public.projeto_secoes ps ON ps.projeto_id = p.id
    JOIN public.projeto_tarefas t ON t.secao_id = ps.id
    WHERE t.status <> 'concluida'
      AND t.excluida_em IS NULL
      AND t.data_prazo IS NOT NULL
      AND (
        (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date = v_today + INTERVAL '3 days'
        OR (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date = v_today + INTERVAL '1 day'
        OR (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date < v_today
      )
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.projeto_chat_messages
      WHERE projeto_id = v_proj.id
        AND tipo = 'sistema'
        AND created_at::date = v_today
        AND metadata->>'tipo' = 'prazos_alerta'
    ) INTO v_ja_existe;

    IF v_ja_existe THEN
      RETURN QUERY SELECT v_proj.id, false;
      CONTINUE;
    END IF;

    v_conteudo := '**Resumo de prazos - ' || to_char(v_today, 'DD/MM/YYYY') || '**' || E'\n\n';
    v_tem_conteudo := false;

    DECLARE v_temp text := '';
    BEGIN
      SELECT string_agg(
        '- *' || LEFT(t.titulo, 80) || '*' ||
        CASE WHEN pr.nome IS NOT NULL THEN ' - ' || pr.nome ELSE '' END, E'\n'
      ) INTO v_temp
      FROM public.projeto_tarefas t
      JOIN public.projeto_secoes ps ON ps.id = t.secao_id
      LEFT JOIN public.profiles pr ON pr.id = t.responsavel_id
      WHERE ps.projeto_id = v_proj.id
        AND t.status <> 'concluida'
        AND t.excluida_em IS NULL
        AND t.data_prazo IS NOT NULL
        AND (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date < v_today;
      IF v_temp IS NOT NULL AND length(v_temp) > 0 THEN
        v_conteudo := v_conteudo || '**Em atraso**' || E'\n' || v_temp || E'\n\n';
        v_tem_conteudo := true;
      END IF;
    END;

    DECLARE v_temp text := '';
    BEGIN
      SELECT string_agg(
        '- *' || LEFT(t.titulo, 80) || '*' ||
        CASE WHEN pr.nome IS NOT NULL THEN ' - ' || pr.nome ELSE '' END, E'\n'
      ) INTO v_temp
      FROM public.projeto_tarefas t
      JOIN public.projeto_secoes ps ON ps.id = t.secao_id
      LEFT JOIN public.profiles pr ON pr.id = t.responsavel_id
      WHERE ps.projeto_id = v_proj.id
        AND t.status <> 'concluida'
        AND t.excluida_em IS NULL
        AND (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date = v_today + INTERVAL '1 day';
      IF v_temp IS NOT NULL AND length(v_temp) > 0 THEN
        v_conteudo := v_conteudo || '**Vence amanha**' || E'\n' || v_temp || E'\n\n';
        v_tem_conteudo := true;
      END IF;
    END;

    DECLARE v_temp text := '';
    BEGIN
      SELECT string_agg(
        '- *' || LEFT(t.titulo, 80) || '*' ||
        CASE WHEN pr.nome IS NOT NULL THEN ' - ' || pr.nome ELSE '' END, E'\n'
      ) INTO v_temp
      FROM public.projeto_tarefas t
      JOIN public.projeto_secoes ps ON ps.id = t.secao_id
      LEFT JOIN public.profiles pr ON pr.id = t.responsavel_id
      WHERE ps.projeto_id = v_proj.id
        AND t.status <> 'concluida'
        AND t.excluida_em IS NULL
        AND (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date = v_today + INTERVAL '3 days';
      IF v_temp IS NOT NULL AND length(v_temp) > 0 THEN
        v_conteudo := v_conteudo || '**Vence em 3 dias**' || E'\n' || v_temp;
        v_tem_conteudo := true;
      END IF;
    END;

    IF NOT v_tem_conteudo THEN
      RETURN QUERY SELECT v_proj.id, false;
      CONTINUE;
    END IF;

    INSERT INTO public.projeto_chat_messages (
      projeto_id, user_id, conteudo, tipo, metadata
    ) VALUES (
      v_proj.id, NULL, v_conteudo, 'sistema',
      jsonb_build_object('tipo', 'prazos_alerta', 'data', v_today::text)
    );

    RETURN QUERY SELECT v_proj.id, true;
  END LOOP;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.notify_task_deadlines_chat() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.notify_task_deadlines_chat() TO authenticated, service_role;

DO $mig$
DECLARE v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'projetos-notify-deadlines-chat';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'projetos-notify-deadlines-chat',
    '5 11 * * *',
    $cron$ SELECT public.notify_task_deadlines_chat(); $cron$
  );
END $mig$;

-- ============================================================================
-- BLOCO 07 - chat_aprovacoes
-- ============================================================================
DO $mig$ BEGIN RAISE NOTICE '>>> [07/10] chat_aprovacoes'; END $mig$;

CREATE TABLE IF NOT EXISTS public.chat_aprovacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id     uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  mensagem_id     uuid REFERENCES public.mensagens(id) ON DELETE SET NULL,
  solicitante_id  uuid NOT NULL,
  titulo          text NOT NULL CHECK (length(trim(titulo)) > 0),
  descricao       text,
  status          text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'cancelado')),
  decidido_por    uuid,
  decidido_em     timestamptz,
  motivo          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_aprovacoes_conversa
  ON public.chat_aprovacoes (conversa_id, created_at DESC);

ALTER TABLE public.chat_aprovacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_aprovacoes_select ON public.chat_aprovacoes;
CREATE POLICY chat_aprovacoes_select ON public.chat_aprovacoes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id = chat_aprovacoes.conversa_id
      AND cp.usuario_id = auth.uid()
      AND cp.saiu_em IS NULL
  )
);

ALTER TABLE public.chat_aprovacoes REPLICA IDENTITY FULL;
DO $mig$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_aprovacoes;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $mig$;

CREATE OR REPLACE FUNCTION public.rpc_chat_aprovacao_criar(
  p_conversa_id uuid,
  p_titulo      text,
  p_descricao   text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_id      uuid;
  v_msg_id  uuid;
  v_titulo  text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  v_titulo := trim(coalesce(p_titulo, ''));
  IF v_titulo = '' THEN RAISE EXCEPTION 'titulo obrigatorio'; END IF;
  IF length(v_titulo) > 200 THEN v_titulo := substring(v_titulo from 1 for 200); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes
    WHERE conversa_id = p_conversa_id AND usuario_id = v_uid AND saiu_em IS NULL
  ) THEN RAISE EXCEPTION 'sem acesso a conversa'; END IF;

  INSERT INTO public.chat_aprovacoes (conversa_id, solicitante_id, titulo, descricao)
  VALUES (p_conversa_id, v_uid, v_titulo, NULLIF(trim(coalesce(p_descricao, '')), ''))
  RETURNING id INTO v_id;

  INSERT INTO public.mensagens (
    conversa_id, remetente_id, conteudo, tipo, metadata
  ) VALUES (
    p_conversa_id, v_uid, 'Pedido de aprovacao: ' || v_titulo, 'sistema',
    jsonb_build_object('aprovacao_id', v_id::text)
  )
  RETURNING id INTO v_msg_id;

  UPDATE public.chat_aprovacoes SET mensagem_id = v_msg_id WHERE id = v_id;

  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.rpc_chat_aprovacao_criar(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_chat_aprovacao_criar(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_chat_aprovacao_decidir(
  p_aprovacao_id uuid,
  p_status       text,
  p_motivo       text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_uid           uuid := auth.uid();
  v_conv_id       uuid;
  v_solic_id      uuid;
  v_status_atual  text;
  v_titulo        text;
  v_conteudo      text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_status NOT IN ('aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'status deve ser aprovado ou rejeitado';
  END IF;

  SELECT conversa_id, solicitante_id, status, titulo
    INTO v_conv_id, v_solic_id, v_status_atual, v_titulo
  FROM public.chat_aprovacoes WHERE id = p_aprovacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'aprovacao nao encontrada'; END IF;
  IF v_status_atual <> 'pendente' THEN
    RAISE EXCEPTION 'aprovacao ja decidida (status: %)', v_status_atual;
  END IF;
  IF v_uid = v_solic_id THEN
    RAISE EXCEPTION 'voce nao pode decidir sua propria solicitacao';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes
    WHERE conversa_id = v_conv_id AND usuario_id = v_uid AND saiu_em IS NULL
  ) THEN RAISE EXCEPTION 'sem acesso'; END IF;

  UPDATE public.chat_aprovacoes
     SET status = p_status, decidido_por = v_uid, decidido_em = now(),
         motivo = NULLIF(trim(coalesce(p_motivo, '')), '')
   WHERE id = p_aprovacao_id;

  v_conteudo :=
    CASE WHEN p_status = 'aprovado' THEN 'Aprovou: ' ELSE 'Rejeitou: ' END
    || v_titulo
    || COALESCE(E'\n\nMotivo: ' || p_motivo, '');

  INSERT INTO public.mensagens (
    conversa_id, remetente_id, conteudo, tipo, metadata
  ) VALUES (
    v_conv_id, v_uid, v_conteudo, 'sistema',
    jsonb_build_object('aprovacao_decisao_id', p_aprovacao_id::text, 'status', p_status)
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.rpc_chat_aprovacao_decidir(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_chat_aprovacao_decidir(uuid, text, text) TO authenticated;

-- ============================================================================
-- BLOCO 08 - user_presence_status
-- ============================================================================
DO $mig$ BEGIN RAISE NOTICE '>>> [08/10] user_presence_status'; END $mig$;

CREATE TABLE IF NOT EXISTS public.user_presence_status (
  user_id     uuid PRIMARY KEY,
  status      text NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel', 'ocupado', 'em_reuniao', 'ausente', 'nao_perturbe')),
  mensagem    text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS presence_status_select ON public.user_presence_status;
CREATE POLICY presence_status_select ON public.user_presence_status
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS presence_status_upsert ON public.user_presence_status;
CREATE POLICY presence_status_upsert ON public.user_presence_status
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS presence_status_update ON public.user_presence_status;
CREATE POLICY presence_status_update ON public.user_presence_status
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_presence_status REPLICA IDENTITY FULL;
DO $mig$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence_status;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $mig$;

CREATE OR REPLACE FUNCTION public.tg_presence_status_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN NEW.updated_at := now(); RETURN NEW; END $fn$;

DROP TRIGGER IF EXISTS trg_presence_status_updated_at ON public.user_presence_status;
CREATE TRIGGER trg_presence_status_updated_at
BEFORE UPDATE ON public.user_presence_status
FOR EACH ROW EXECUTE FUNCTION public.tg_presence_status_updated_at();

-- ============================================================================
-- BLOCO 09 - china_produto_documentos_historico
-- ============================================================================
DO $mig$ BEGIN RAISE NOTICE '>>> [09/10] china_produto_documentos_historico'; END $mig$;

CREATE TABLE IF NOT EXISTS public.china_produto_documentos_historico (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id     uuid REFERENCES public.china_produto_documentos(id) ON DELETE CASCADE,
  submissao_id     uuid NOT NULL,
  tipo_documento   text NOT NULL,
  arquivo_path     text,
  arquivo_url      text,
  nome_arquivo     text,
  status           text NOT NULL,
  observacao       text,
  versionado_em    timestamptz NOT NULL DEFAULT now(),
  versionado_por   uuid,
  acao             text
);

CREATE INDEX IF NOT EXISTS idx_china_doc_historico_documento
  ON public.china_produto_documentos_historico (documento_id, versionado_em DESC);
CREATE INDEX IF NOT EXISTS idx_china_doc_historico_submissao
  ON public.china_produto_documentos_historico (submissao_id, versionado_em DESC);

ALTER TABLE public.china_produto_documentos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS china_doc_historico_select ON public.china_produto_documentos_historico;
CREATE POLICY china_doc_historico_select ON public.china_produto_documentos_historico
FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.fn_log_china_documento_versao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.arquivo_path IS DISTINCT FROM NEW.arquivo_path
    OR OLD.status IS DISTINCT FROM NEW.status
  ) THEN
    INSERT INTO public.china_produto_documentos_historico (
      documento_id, submissao_id, tipo_documento, arquivo_path, arquivo_url,
      nome_arquivo, status, observacao, versionado_por, acao
    ) VALUES (
      OLD.id, OLD.submissao_id, OLD.tipo_documento, OLD.arquivo_path, OLD.arquivo_url,
      OLD.nome_arquivo, OLD.status, OLD.observacao, auth.uid(),
      CASE WHEN OLD.arquivo_path IS DISTINCT FROM NEW.arquivo_path THEN 'atualizado_arquivo'
           ELSE 'mudou_status' END
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.china_produto_documentos_historico (
      documento_id, submissao_id, tipo_documento, arquivo_path, arquivo_url,
      nome_arquivo, status, observacao, versionado_por, acao
    ) VALUES (
      OLD.id, OLD.submissao_id, OLD.tipo_documento, OLD.arquivo_path, OLD.arquivo_url,
      OLD.nome_arquivo, OLD.status, OLD.observacao, auth.uid(), 'deletado'
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS tg_log_china_documento_versao ON public.china_produto_documentos;
CREATE TRIGGER tg_log_china_documento_versao
BEFORE UPDATE OR DELETE ON public.china_produto_documentos
FOR EACH ROW EXECUTE FUNCTION public.fn_log_china_documento_versao();

-- ============================================================================
-- BLOCO 10 - notify_china_oc_sla
-- ============================================================================
DO $mig$ BEGIN RAISE NOTICE '>>> [10/10] notify_china_oc_sla'; END $mig$;

CREATE OR REPLACE FUNCTION public.notify_china_oc_sla()
RETURNS TABLE(submissao_id uuid, alertas int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_today        date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_sub          RECORD;
  v_conteudo     text;
  v_ja_existe    boolean;
  v_temp         text;
  v_count        int;
  IA_USER constant uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  FOR v_sub IN
    SELECT DISTINCT s.id, s.produto_codigo, s.produto_nome
    FROM public.china_produto_submissoes s
    JOIN public.china_ordens_compra oc ON oc.submissao_id = s.id
    WHERE oc.data_entrega_prevista IS NOT NULL
      AND oc.data_entrega_real IS NULL
      AND oc.status NOT IN ('cancelada', 'concluida')
      AND (
        oc.data_entrega_prevista < v_today
        OR oc.data_entrega_prevista BETWEEN v_today AND v_today + INTERVAL '3 days'
      )
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.china_chat_mensagens
      WHERE submissao_id = v_sub.id
        AND tipo = 'ia'
        AND created_at::date = v_today
        AND conteudo LIKE 'Alerta de prazo%'
    ) INTO v_ja_existe;
    IF v_ja_existe THEN
      RETURN QUERY SELECT v_sub.id, 0;
      CONTINUE;
    END IF;

    v_conteudo := '**Alerta de prazo - ' || to_char(v_today, 'DD/MM/YYYY') || '**' || E'\n\n';
    v_count := 0;

    SELECT string_agg(
      '- *' || oc.numero_oc || '* ' || oc.produto_nome
      || ' - atrasada ha ' || (v_today - oc.data_entrega_prevista)::text || ' dia(s)', E'\n'
    ) INTO v_temp
    FROM public.china_ordens_compra oc
    WHERE oc.submissao_id = v_sub.id
      AND oc.data_entrega_real IS NULL
      AND oc.data_entrega_prevista < v_today
      AND oc.status NOT IN ('cancelada', 'concluida');
    IF v_temp IS NOT NULL THEN
      v_conteudo := v_conteudo || '**Atrasadas**' || E'\n' || v_temp || E'\n\n';
      v_count := v_count + 1;
    END IF;

    SELECT string_agg(
      '- *' || oc.numero_oc || '* ' || oc.produto_nome
      || ' - vence em ' || (oc.data_entrega_prevista - v_today)::text || ' dia(s)', E'\n'
    ) INTO v_temp
    FROM public.china_ordens_compra oc
    WHERE oc.submissao_id = v_sub.id
      AND oc.data_entrega_real IS NULL
      AND oc.data_entrega_prevista BETWEEN v_today AND v_today + INTERVAL '3 days'
      AND oc.status NOT IN ('cancelada', 'concluida');
    IF v_temp IS NOT NULL THEN
      v_conteudo := v_conteudo || '**Vence em ate 3 dias**' || E'\n' || v_temp;
      v_count := v_count + 1;
    END IF;

    IF v_count > 0 THEN
      INSERT INTO public.china_chat_mensagens (
        submissao_id, usuario_id, usuario_nome, conteudo, tipo
      ) VALUES (
        v_sub.id, IA_USER, 'Sistema (IA)', v_conteudo, 'ia'
      );
    END IF;

    RETURN QUERY SELECT v_sub.id, v_count;
  END LOOP;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.notify_china_oc_sla() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.notify_china_oc_sla() TO authenticated, service_role;

DO $mig$
DECLARE v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'china-oc-sla-alerta';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'china-oc-sla-alerta',
    '0 12 * * *',
    $cron$ SELECT public.notify_china_oc_sla(); $cron$
  );
END $mig$;

DO $mig$ BEGIN RAISE NOTICE '>>> Roteiro consolidado aplicado com sucesso'; END $mig$;