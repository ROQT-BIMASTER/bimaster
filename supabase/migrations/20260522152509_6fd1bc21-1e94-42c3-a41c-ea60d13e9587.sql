-- 1) attachments column on briefing_mensagens
ALTER TABLE public.briefing_mensagens
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) storage bucket for chat attachments (images for AI vision)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'briefing-chat-anexos',
  'briefing-chat-anexos',
  false,
  10485760,
  ARRAY['image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS policies: path must start with <briefing_id>/<uid>/...
DROP POLICY IF EXISTS "briefing_chat_anexos_select_owned" ON storage.objects;
CREATE POLICY "briefing_chat_anexos_select_owned"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'briefing-chat-anexos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      (storage.foldername(name))[2] = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM public.briefings b
        WHERE b.id::text = (storage.foldername(name))[1]
          AND (b.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
      )
    )
  )
);

DROP POLICY IF EXISTS "briefing_chat_anexos_insert_owned" ON storage.objects;
CREATE POLICY "briefing_chat_anexos_insert_owned"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'briefing-chat-anexos'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.briefings b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND (b.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS "briefing_chat_anexos_delete_owned" ON storage.objects;
CREATE POLICY "briefing_chat_anexos_delete_owned"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'briefing-chat-anexos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- 3) Suggestions table
CREATE TABLE IF NOT EXISTS public.briefing_sugestoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  mensagem_id uuid REFERENCES public.briefing_mensagens(id) ON DELETE SET NULL,
  campo text NOT NULL,
  valor_atual text,
  sugestao text NOT NULL,
  justificativa text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aceita','rejeitada')),
  decided_by uuid,
  decided_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_sugestoes_briefing
  ON public.briefing_sugestoes (briefing_id, created_at DESC);

ALTER TABLE public.briefing_sugestoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sugestoes_select_owner_or_admin" ON public.briefing_sugestoes;
CREATE POLICY "sugestoes_select_owner_or_admin"
ON public.briefing_sugestoes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.briefings b
    WHERE b.id = briefing_sugestoes.briefing_id
      AND b.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "sugestoes_insert_owner_or_admin" ON public.briefing_sugestoes;
CREATE POLICY "sugestoes_insert_owner_or_admin"
ON public.briefing_sugestoes FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.briefings b
    WHERE b.id = briefing_sugestoes.briefing_id
      AND b.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "sugestoes_update_owner_or_admin" ON public.briefing_sugestoes;
CREATE POLICY "sugestoes_update_owner_or_admin"
ON public.briefing_sugestoes FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.briefings b
    WHERE b.id = briefing_sugestoes.briefing_id
      AND b.user_id = auth.uid()
  )
);

-- 4) RPC to accept a suggestion (writes to canvas + marks accepted)
CREATE OR REPLACE FUNCTION public.rpc_aceitar_sugestao_briefing(p_sugestao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s public.briefing_sugestoes;
  v_b public.briefings;
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_total int;
  v_filled int;
  v_completude int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT * INTO v_s FROM public.briefing_sugestoes WHERE id = p_sugestao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sugestao_nao_encontrada';
  END IF;

  SELECT * INTO v_b FROM public.briefings WHERE id = v_s.briefing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'briefing_nao_encontrado';
  END IF;

  IF v_b.user_id <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  IF v_s.status <> 'pendente' THEN
    RAISE EXCEPTION 'sugestao_ja_decidida';
  END IF;

  v_payload := COALESCE(v_b.payload, '{}'::jsonb) || jsonb_build_object(v_s.campo, v_s.sugestao);

  SELECT COUNT(*) INTO v_total
  FROM jsonb_array_elements(
    COALESCE(
      (SELECT secoes FROM public.briefing_templates WHERE id = v_b.template_id),
      '[]'::jsonb
    )
  );
  IF v_total = 0 THEN v_total := 1; END IF;

  SELECT COUNT(*) INTO v_filled
  FROM jsonb_each_text(v_payload) e
  WHERE length(btrim(e.value)) > 0;

  v_completude := LEAST(100, ROUND((v_filled::numeric / v_total) * 100)::int);

  UPDATE public.briefings
     SET payload = v_payload,
         completude = v_completude,
         status = CASE WHEN status = 'em_aprovacao' THEN status ELSE 'em_andamento' END
   WHERE id = v_b.id;

  UPDATE public.briefing_sugestoes
     SET status = 'aceita',
         decided_by = v_uid,
         decided_at = now()
   WHERE id = p_sugestao_id;

  RETURN jsonb_build_object(
    'ok', true,
    'campo', v_s.campo,
    'completude', v_completude
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_aceitar_sugestao_briefing(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_aceitar_sugestao_briefing(uuid) TO authenticated;

-- 5) RPC to reject a suggestion
CREATE OR REPLACE FUNCTION public.rpc_rejeitar_sugestao_briefing(p_sugestao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s public.briefing_sugestoes;
  v_b public.briefings;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT * INTO v_s FROM public.briefing_sugestoes WHERE id = p_sugestao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sugestao_nao_encontrada';
  END IF;

  SELECT * INTO v_b FROM public.briefings WHERE id = v_s.briefing_id;
  IF v_b.user_id <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  IF v_s.status <> 'pendente' THEN
    RAISE EXCEPTION 'sugestao_ja_decidida';
  END IF;

  UPDATE public.briefing_sugestoes
     SET status = 'rejeitada', decided_by = v_uid, decided_at = now()
   WHERE id = p_sugestao_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_rejeitar_sugestao_briefing(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_rejeitar_sugestao_briefing(uuid) TO authenticated;