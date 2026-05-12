-- ============================================================================
-- Série 1 - PR 1: Hardening RLS módulo China
-- Achados 3, 4, 6 da auditoria audit/modulo-china
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ACHADO 6: china_oc_versoes SELECT USING (true) → vazamento cross-tenant
--   de snapshots (custos USD, fórmulas) entre OCs.
-- Mitigação: restringir via semi-join nas OCs visíveis ao usuário.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read OC versions" ON public.china_oc_versoes;
CREATE POLICY "Read OC versions when OC is visible"
  ON public.china_oc_versoes FOR SELECT
  TO authenticated
  USING (
    ordem_compra_id IN (SELECT id FROM public.china_ordens_compra)
  );

-- ---------------------------------------------------------------------------
-- ACHADO 4: UPDATE em china_chat_mensagens com USING (true) WITH CHECK (true)
--   permitia qualquer autenticado editar conteudo/anexos/mencoes de mensagens
--   alheias (RLS por coluna não existe em Postgres).
-- Mitigação:
--   - DROP da policy permissiva
--   - SELECT/INSERT também restritos por acesso à submissão
--   - RPC dedicada para gravar tradução automática (cache compartilhado)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can cache translations" ON public.china_chat_mensagens;

DROP POLICY IF EXISTS "Authenticated users can read chat messages" ON public.china_chat_mensagens;
CREATE POLICY "Read chat when submission is visible"
  ON public.china_chat_mensagens FOR SELECT
  TO authenticated
  USING (
    submissao_id IN (SELECT id FROM public.china_produto_submissoes)
  );

DROP POLICY IF EXISTS "Authenticated users can insert chat messages" ON public.china_chat_mensagens;
CREATE POLICY "Insert own chat in visible submission"
  ON public.china_chat_mensagens FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = usuario_id
    AND submissao_id IN (SELECT id FROM public.china_produto_submissoes)
  );

-- "Users can update their own messages" mantida (autor edita o próprio conteúdo).

-- RPC para cache compartilhado de tradução automática.
-- Permite a qualquer participante da submissão acrescentar traduções de
-- qualquer mensagem da MESMA submissão, mas restringe a coluna afetada
-- a `traducoes` (não dá pra editar conteudo/anexos por aqui).
CREATE OR REPLACE FUNCTION public.rpc_china_chat_set_traducao(
  p_msg_id uuid,
  p_idioma text,
  p_texto text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submissao_id uuid;
  v_visivel boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF p_idioma NOT IN ('pt','zh','en') THEN
    RAISE EXCEPTION 'Idioma inválido';
  END IF;
  IF p_texto IS NULL OR length(p_texto) = 0 OR length(p_texto) > 8000 THEN
    RAISE EXCEPTION 'Texto inválido';
  END IF;

  SELECT submissao_id INTO v_submissao_id
    FROM public.china_chat_mensagens WHERE id = p_msg_id;
  IF v_submissao_id IS NULL THEN
    RAISE EXCEPTION 'Mensagem não encontrada';
  END IF;

  -- O caller precisa enxergar a submissão (RLS de china_produto_submissoes)
  SELECT EXISTS (
    SELECT 1 FROM public.china_produto_submissoes WHERE id = v_submissao_id
  ) INTO v_visivel;
  IF NOT v_visivel THEN
    RAISE EXCEPTION 'Sem acesso à submissão';
  END IF;

  UPDATE public.china_chat_mensagens
     SET traducoes = COALESCE(traducoes, '{}'::jsonb)
                    || jsonb_build_object(p_idioma, p_texto)
   WHERE id = p_msg_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_china_chat_set_traducao(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- ACHADO 3: Bucket china-chat-anexos SELECT USING (bucket_id = ...)
--   sem filtro de path → qualquer autenticado lê anexos de qualquer submissão.
-- Path convencional: <submissao_id>/<uid>/<filename>
-- Mitigação: exigir que o submissao_id do path seja visível ao usuário.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "china-chat-anexos: leitura autenticados" ON storage.objects;
CREATE POLICY "china-chat-anexos: leitura por acesso à submissão"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'china-chat-anexos'
    AND (
      -- foldername[1] = submissao_id; rejeita paths malformados via cast seguro
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND ((storage.foldername(name))[1])::uuid IN (
        SELECT id FROM public.china_produto_submissoes
      )
    )
  );

-- INSERT de anexos: além do owner-uid no path, exigir submissão visível.
DROP POLICY IF EXISTS "china-chat-anexos: insert do dono" ON storage.objects;
CREATE POLICY "china-chat-anexos: insert do dono em submissão visível"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'china-chat-anexos'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND ((storage.foldername(name))[1])::uuid IN (
      SELECT id FROM public.china_produto_submissoes
    )
  );

-- DELETE: dono do arquivo; mantém política existente.