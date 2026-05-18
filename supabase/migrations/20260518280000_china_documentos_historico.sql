-- =========================================================================
-- china_produto_documentos_historico — log de versões anteriores
-- =========================================================================
--
-- Quando China envia documento e Brasil rejeita, China envia versão nova
-- e a anterior é sobrescrita (UPDATE em china_produto_documentos). Sem
-- esta migration, a versão rejeitada some — não dá pra ver o que foi
-- enviado antes ou comparar com a nova.
--
-- Solução: tabela de histórico + trigger BEFORE UPDATE que captura a
-- linha ANTIGA antes de cada mudança em arquivo_path ou status. O código
-- de upload existente NÃO precisa ser alterado.

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
  acao             text  -- 'atualizado_arquivo' | 'mudou_status' | 'deletado'
);

CREATE INDEX IF NOT EXISTS idx_china_doc_historico_documento
  ON public.china_produto_documentos_historico (documento_id, versionado_em DESC);
CREATE INDEX IF NOT EXISTS idx_china_doc_historico_submissao
  ON public.china_produto_documentos_historico (submissao_id, versionado_em DESC);

ALTER TABLE public.china_produto_documentos_historico ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado vê o histórico (mesma política dos próprios
-- documentos da China, que hoje são authenticated USING true)
DROP POLICY IF EXISTS china_doc_historico_select ON public.china_produto_documentos_historico;
CREATE POLICY china_doc_historico_select ON public.china_produto_documentos_historico
FOR SELECT TO authenticated USING (true);

-- INSERT: só via trigger (service_role bypassa RLS quando trigger roda).
-- Sem policy para clients autenticados — evita gravação direta.

-- =========================================================================
-- Trigger: loga linha ANTIGA antes do UPDATE
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fn_log_china_documento_versao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Só loga se mudou arquivo (nova versão do PDF/imagem) ou status
  -- (aprovado/rejeitado). Mudanças triviais como observacao não disparam.
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
      CASE
        WHEN OLD.arquivo_path IS DISTINCT FROM NEW.arquivo_path THEN 'atualizado_arquivo'
        ELSE 'mudou_status'
      END
    );
  END IF;

  -- Loga também em DELETE para não perder histórico se documento sumir
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
$$;

DROP TRIGGER IF EXISTS tg_log_china_documento_versao ON public.china_produto_documentos;
CREATE TRIGGER tg_log_china_documento_versao
BEFORE UPDATE OR DELETE ON public.china_produto_documentos
FOR EACH ROW EXECUTE FUNCTION public.fn_log_china_documento_versao();

COMMENT ON TABLE public.china_produto_documentos_historico IS
  'Log automatico de versoes anteriores de china_produto_documentos.
   Trigger BEFORE UPDATE/DELETE captura linha antiga quando arquivo_path
   ou status mudam. UI da Ficha Produto consulta isso pra mostrar
   "Versao 1, 2, 3..." quando China reenvia doc rejeitado.';
