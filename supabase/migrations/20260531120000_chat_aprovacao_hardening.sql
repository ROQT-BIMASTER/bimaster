-- =========================================================================
-- Hardening da feature de aprovações do chat (follow-up da auditoria do PR #70)
-- =========================================================================
--
-- Aditivo e idempotente. NÃO recria tabela/bucket; apenas:
--   1) valida o formato do hash (SHA-256 hex) na RPC de anexar documento;
--   2) CHECK defensivo do mesmo formato na coluna hash_arquivo;
--   3) restringe a DELETE policy do storage a aprovações ainda 'pendente'
--      (protege a trilha de auditoria após decisão).
--
-- Modelo de assinatura permanece SIMPLES (Lei 14.063): nada de carimbo em PDF,
-- edge function ou provedor externo. signed_storage_path continua NULL.

-- 1) RPC: mesma assinatura/lógica + validação de formato do hash
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

  -- integridade da trilha: hash, quando informado, deve ser SHA-256 hex (64)
  IF p_hash IS NOT NULL AND p_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'hash invalido (esperado SHA-256 hex de 64 chars)';
  END IF;

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

-- 2) CHECK defensivo do formato do hash (NOT VALID p/ não travar legados; VALIDATE em seguida)
DO $$ BEGIN
  ALTER TABLE public.chat_aprovacao_documentos
    ADD CONSTRAINT chat_aprov_docs_hash_fmt
    CHECK (hash_arquivo IS NULL OR hash_arquivo ~ '^[0-9a-f]{64}$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.chat_aprovacao_documentos VALIDATE CONSTRAINT chat_aprov_docs_hash_fmt;
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'chat_aprov_docs_hash_fmt nao validado: existem linhas com hash_arquivo fora do formato SHA-256';
END $$;

-- 3) DELETE no storage só enquanto a aprovação está pendente
-- Path: <conversa_id>/<aprovacao_id>/<uid>/<arquivo> → foldername[2] = aprovacao_id
DROP POLICY IF EXISTS aprov_docs_storage_delete ON storage.objects;
CREATE POLICY aprov_docs_storage_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'aprovacao-documentos'
  AND (storage.foldername(name))[3] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.chat_aprovacoes a
    WHERE a.id = ((storage.foldername(name))[2])::uuid
      AND a.status = 'pendente'
  )
);

COMMENT ON CONSTRAINT chat_aprov_docs_hash_fmt ON public.chat_aprovacao_documentos IS
  'hash_arquivo deve ser SHA-256 hex (64) ou NULL — integridade da trilha de auditoria.';
