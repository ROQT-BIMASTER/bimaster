CREATE TABLE IF NOT EXISTS public.china_doc_notif_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('em_analise','pendente','aprovado','rejeitado','reaberto')),
  papel text NOT NULL CHECK (papel IN ('responsavel','supervisor')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, status, papel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.china_doc_notif_prefs TO authenticated;
GRANT ALL ON public.china_doc_notif_prefs TO service_role;

ALTER TABLE public.china_doc_notif_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own prefs select" ON public.china_doc_notif_prefs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own prefs insert" ON public.china_doc_notif_prefs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own prefs update" ON public.china_doc_notif_prefs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own prefs delete" ON public.china_doc_notif_prefs
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_china_doc_notif_prefs_touch
  BEFORE UPDATE ON public.china_doc_notif_prefs
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

CREATE OR REPLACE FUNCTION public.china_doc_notificar_status(
  p_documento_id uuid,
  p_status text,
  p_status_anterior text,
  p_ator uuid,
  p_ator_nome text,
  p_parecer text DEFAULT NULL,
  p_projeto_id uuid DEFAULT NULL,
  p_tarefa_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _doc RECORD;
  _label text;
  _titulo text;
  _msg text;
  _url text;
  _rec RECORD;
  _n integer := 0;
  _nomes text := '';
  _optout text := '';
  _quer boolean;
BEGIN
  SELECT id, nome_arquivo, tipo_documento, submissao_id
    INTO _doc
  FROM public.china_produto_documentos WHERE id = p_documento_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  _label := COALESCE(NULLIF(_doc.nome_arquivo, ''), _doc.tipo_documento, 'Documento');

  _titulo := CASE p_status
    WHEN 'aprovado' THEN 'Documento aprovado'
    WHEN 'rejeitado' THEN 'Documento não aprovado'
    WHEN 'em_analise' THEN 'Documento em análise'
    WHEN 'reaberto' THEN 'Documento reaberto para nova análise'
    ELSE 'Documento pendente de aprovação'
  END;

  _msg := _label || ' — situação alterada por ' || COALESCE(p_ator_nome, 'um usuário')
          || COALESCE('. Parecer: ' || NULLIF(p_parecer, ''), '');

  _url := CASE
    WHEN p_projeto_id IS NOT NULL AND p_tarefa_id IS NOT NULL
      THEN '/dashboard/projetos/' || p_projeto_id::text || '?tarefa=' || p_tarefa_id::text
    WHEN p_projeto_id IS NOT NULL THEN '/dashboard/projetos/' || p_projeto_id::text
    ELSE NULL
  END;

  FOR _rec IN
    WITH resp AS (
      SELECT DISTINCT u FROM (
        SELECT t.responsavel_id AS u
          FROM public.projeto_tarefas t
         WHERE p_tarefa_id IS NOT NULL AND t.id = p_tarefa_id
        UNION
        SELECT v.responsavel_id FROM public.china_documento_tarefa_vinculos v
         WHERE v.documento_id = p_documento_id
        UNION
        SELECT v.created_by FROM public.china_documento_tarefa_vinculos v
         WHERE v.documento_id = p_documento_id
      ) s WHERE u IS NOT NULL
    ),
    sup AS (
      SELECT DISTINCT p.supervisor_id AS u
        FROM public.profiles p
       WHERE p.id IN (SELECT u FROM resp) AND p.supervisor_id IS NOT NULL
    )
    SELECT u, 'responsavel'::text AS papel FROM resp
    UNION ALL
    SELECT u, 'supervisor'::text FROM sup WHERE u NOT IN (SELECT u FROM resp)
  LOOP
    CONTINUE WHEN _rec.u = COALESCE(p_ator, '00000000-0000-0000-0000-000000000000'::uuid);

    SELECT pr.enabled INTO _quer
      FROM public.china_doc_notif_prefs pr
     WHERE pr.user_id = _rec.u AND pr.status = p_status AND pr.papel = _rec.papel;

    IF _quer IS FALSE THEN
      _optout := _optout || COALESCE((SELECT nome FROM public.profiles WHERE id = _rec.u), _rec.u::text) || '; ';
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (_rec.u, 'china_doc_status', _titulo, _msg, _url);
    _n := _n + 1;
    _nomes := _nomes || COALESCE((SELECT nome FROM public.profiles WHERE id = _rec.u), _rec.u::text)
              || ' (' || _rec.papel || '); ';
  END LOOP;

  INSERT INTO public.china_produto_documentos_historico (
    documento_id, submissao_id, tipo_documento, nome_arquivo, status,
    observacao, versionado_por, acao
  ) VALUES (
    p_documento_id, _doc.submissao_id, _doc.tipo_documento, _doc.nome_arquivo, p_status,
    'Situação alterada de ' || COALESCE(p_status_anterior, '—') || ' para ' || p_status
      || COALESCE(' | Parecer: ' || NULLIF(p_parecer, ''), '')
      || CASE WHEN _n > 0 THEN ' | Notificados: ' || _nomes ELSE ' | Sem destinatários para notificar' END
      || CASE WHEN _optout <> '' THEN ' | Sem aviso por preferência: ' || _optout ELSE '' END,
    p_ator, 'notificacao_status'
  );

  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.china_doc_notificar_status(uuid, text, text, uuid, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.china_doc_notificar_status(uuid, text, text, uuid, text, text, uuid, uuid) TO authenticated, service_role;