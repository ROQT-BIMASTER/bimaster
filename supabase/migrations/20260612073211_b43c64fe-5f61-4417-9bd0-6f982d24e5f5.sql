
ALTER TABLE public.china_doc_revisoes
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE TABLE IF NOT EXISTS public.china_doc_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.china_produto_documentos(id) ON DELETE CASCADE,
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  tipo_documento text NOT NULL,
  autor_id uuid NOT NULL,
  autor_nome text NOT NULL,
  lado text NOT NULL CHECK (lado IN ('brasil','china')),
  conteudo text NOT NULL DEFAULT '',
  conteudo_idioma_origem text,
  conteudo_traducoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  mentions uuid[] NOT NULL DEFAULT '{}'::uuid[],
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ref_rodada integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_china_doc_comentarios_doc ON public.china_doc_comentarios(documento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_china_doc_comentarios_sub ON public.china_doc_comentarios(submissao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.china_doc_comentarios TO authenticated;
GRANT ALL ON public.china_doc_comentarios TO service_role;

ALTER TABLE public.china_doc_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "china_doc_comentarios select"
  ON public.china_doc_comentarios FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "china_doc_comentarios insert"
  ON public.china_doc_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (autor_id = auth.uid());

CREATE POLICY "china_doc_comentarios update"
  ON public.china_doc_comentarios FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (autor_id = auth.uid() AND created_at > now() - interval '15 minutes')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (autor_id = auth.uid() AND created_at > now() - interval '15 minutes')
  );

CREATE POLICY "china_doc_comentarios delete"
  ON public.china_doc_comentarios FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR autor_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.china_doc_comentarios_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_china_doc_comentarios_updated_at ON public.china_doc_comentarios;
CREATE TRIGGER trg_china_doc_comentarios_updated_at
  BEFORE UPDATE ON public.china_doc_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.china_doc_comentarios_set_updated_at();

CREATE OR REPLACE FUNCTION public.notificar_mencao_checklist_china()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
  v_projeto_id uuid;
  v_produto_nome text;
  v_autor text;
  v_titulo text;
  v_mensagem text;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT csp.projeto_id INTO v_projeto_id
  FROM public.china_submissao_projetos csp
  WHERE csp.submissao_id = NEW.submissao_id
  ORDER BY csp.created_at DESC
  LIMIT 1;

  SELECT produto_nome INTO v_produto_nome
  FROM public.china_produto_submissoes WHERE id = NEW.submissao_id;

  IF TG_TABLE_NAME = 'china_doc_comentarios' THEN
    v_autor := NEW.autor_nome;
    v_titulo := 'Você foi mencionado em um comentário';
  ELSE
    v_autor := COALESCE(NEW.acao_por_nome, 'Usuário');
    v_titulo := 'Você foi mencionado em um parecer';
  END IF;

  v_mensagem := v_autor || ' mencionou você em ' ||
    COALESCE(v_produto_nome, 'um item do checklist');

  FOREACH v_user IN ARRAY NEW.mentions LOOP
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, referencia_id, referencia_tipo)
    VALUES (v_user, v_titulo, v_mensagem, 'mencao_checklist', NEW.submissao_id::text, 'china_checklist');
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_mencao_comentario_china ON public.china_doc_comentarios;
CREATE TRIGGER trg_notificar_mencao_comentario_china
  AFTER INSERT ON public.china_doc_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.notificar_mencao_checklist_china();

DROP TRIGGER IF EXISTS trg_notificar_mencao_revisao_china ON public.china_doc_revisoes;
CREATE TRIGGER trg_notificar_mencao_revisao_china
  AFTER INSERT ON public.china_doc_revisoes
  FOR EACH ROW EXECUTE FUNCTION public.notificar_mencao_checklist_china();
