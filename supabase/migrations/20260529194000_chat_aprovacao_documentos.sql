-- =========================================================================
-- chat_aprovacao_documentos — documentos anexados a um pedido de aprovação
-- =========================================================================
--
-- FASE 1 da feature "documentos + assinatura em aprovações do chat".
-- Permite anexar 1+ documentos a uma aprovação inline (chat_aprovacoes).
-- As colunas de assinatura (hash_arquivo, signed_storage_path, status,
-- assinado_por/em) já existem aqui para a FASE 2 (assinatura manuscrita +
-- PDF carimbado) não precisar de ALTER depois — nesta fase ficam no default.
--
-- Escrita só via RPC (SECURITY DEFINER), igual a chat_aprovacoes: não há
-- policy de INSERT para clients, evitando gravação direta inconsistente.

CREATE TABLE IF NOT EXISTS public.chat_aprovacao_documentos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aprovacao_id        uuid NOT NULL REFERENCES public.chat_aprovacoes(id) ON DELETE CASCADE,
  conversa_id         uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  uploader_id         uuid NOT NULL,
  titulo              text NOT NULL CHECK (length(trim(titulo)) > 0),
  storage_path        text NOT NULL,
  mime_type           text,
  size_bytes          bigint,
  hash_arquivo        text,
  -- FASE 2: cópia carimbada/assinada do PDF + trilha resumida
  signed_storage_path text,
  status              text NOT NULL DEFAULT 'anexado'
    CHECK (status IN ('anexado', 'assinado')),
  assinado_por        uuid,
  assinado_em         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_aprov_docs_aprovacao
  ON public.chat_aprovacao_documentos (aprovacao_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_aprov_docs_conversa
  ON public.chat_aprovacao_documentos (conversa_id, created_at DESC);

ALTER TABLE public.chat_aprovacao_documentos ENABLE ROW LEVEL SECURITY;

-- Grants explícitos (convenção do projeto): authenticated lê via RLS;
-- service_role (RPCs SECURITY DEFINER / Edge) tem acesso total. Não depender
-- de defaults herdados.
GRANT SELECT ON public.chat_aprovacao_documentos TO authenticated;
GRANT ALL    ON public.chat_aprovacao_documentos TO service_role;

-- SELECT: participantes ativos da conversa
DROP POLICY IF EXISTS chat_aprov_docs_select ON public.chat_aprovacao_documentos;
CREATE POLICY chat_aprov_docs_select ON public.chat_aprovacao_documentos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id = chat_aprovacao_documentos.conversa_id
      AND cp.usuario_id = auth.uid()
      AND cp.saiu_em IS NULL
  )
);

-- INSERT/UPDATE só via RPC (service_role bypassa RLS) — sem policy p/ clients.

-- Realtime
ALTER TABLE public.chat_aprovacao_documentos REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_aprovacao_documentos;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- =========================================================================
-- Bucket de storage para os documentos das aprovações (privado, 20MB)
-- =========================================================================
-- 20MB = política de upload do projeto (igual a chat-anexos). DO UPDATE no
-- limite garante que reaplicar a migration ajuste um bucket pré-existente.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('aprovacao-documentos', 'aprovacao-documentos', false, 20971520)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

-- Path pattern: <conversa_id>/<aprovacao_id>/<uid>/<arquivo>
-- foldername[1] = conversa_id (checa participação); foldername[3] = uploader uid.

DROP POLICY IF EXISTS aprov_docs_storage_select ON storage.objects;
CREATE POLICY aprov_docs_storage_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'aprovacao-documentos'
  AND EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id = ((storage.foldername(name))[1])::uuid
      AND cp.usuario_id = auth.uid()
      AND cp.saiu_em IS NULL
  )
);

DROP POLICY IF EXISTS aprov_docs_storage_insert ON storage.objects;
CREATE POLICY aprov_docs_storage_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'aprovacao-documentos'
  AND (storage.foldername(name))[3] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id = ((storage.foldername(name))[1])::uuid
      AND cp.usuario_id = auth.uid()
      AND cp.saiu_em IS NULL
  )
);

DROP POLICY IF EXISTS aprov_docs_storage_delete ON storage.objects;
CREATE POLICY aprov_docs_storage_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'aprovacao-documentos'
  AND (storage.foldername(name))[3] = auth.uid()::text
);

-- =========================================================================
-- RPC: anexar documento a uma aprovação (após upload no storage)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rpc_chat_aprovacao_anexar_documento(
  p_aprovacao_id uuid,
  p_titulo       text,
  p_storage_path text,
  p_mime_type    text DEFAULT NULL,
  p_size_bytes   bigint DEFAULT NULL,
  p_hash         text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_conv_id  uuid;
  v_status   text;
  v_titulo   text;
  v_id       uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  v_titulo := trim(coalesce(p_titulo, ''));
  IF v_titulo = '' THEN RAISE EXCEPTION 'titulo obrigatorio'; END IF;
  IF length(v_titulo) > 200 THEN v_titulo := substring(v_titulo from 1 for 200); END IF;
  IF coalesce(trim(p_storage_path), '') = '' THEN RAISE EXCEPTION 'storage_path obrigatorio'; END IF;

  SELECT conversa_id, status INTO v_conv_id, v_status
  FROM public.chat_aprovacoes WHERE id = p_aprovacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'aprovacao nao encontrada'; END IF;
  IF v_status <> 'pendente' THEN
    RAISE EXCEPTION 'aprovacao ja decidida — nao e possivel anexar documentos';
  END IF;

  -- valida participação
  IF NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes
    WHERE conversa_id = v_conv_id AND usuario_id = v_uid AND saiu_em IS NULL
  ) THEN RAISE EXCEPTION 'sem acesso a conversa'; END IF;

  INSERT INTO public.chat_aprovacao_documentos (
    aprovacao_id, conversa_id, uploader_id, titulo,
    storage_path, mime_type, size_bytes, hash_arquivo
  ) VALUES (
    p_aprovacao_id, v_conv_id, v_uid, v_titulo,
    p_storage_path, p_mime_type, p_size_bytes, NULLIF(trim(coalesce(p_hash, '')), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_chat_aprovacao_anexar_documento(uuid, text, text, text, bigint, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_chat_aprovacao_anexar_documento(uuid, text, text, text, bigint, text) TO authenticated;

COMMENT ON TABLE public.chat_aprovacao_documentos IS
  'Documentos anexados a um pedido de aprovação do chat (chat_aprovacoes). Colunas signed_storage_path/status/assinado_* reservadas para a fase de assinatura.';
COMMENT ON FUNCTION public.rpc_chat_aprovacao_anexar_documento IS
  'Anexa um documento (já enviado ao bucket aprovacao-documentos) a uma aprovação pendente; valida participação na conversa.';
