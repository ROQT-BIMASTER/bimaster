-- Histórico imutável de versões de documentos rejeitados/substituídos
CREATE TABLE public.china_doc_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL,
  submissao_id uuid NOT NULL,
  tipo_documento text NOT NULL,
  rodada integer NOT NULL DEFAULT 1,
  arquivo_path text NOT NULL,
  arquivo_url text,
  nome_arquivo text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  status_no_momento text NOT NULL DEFAULT 'substituido',
  revisao_id uuid,
  enviada_por uuid,
  enviada_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_china_doc_versoes_documento ON public.china_doc_versoes(documento_id, rodada);
CREATE INDEX idx_china_doc_versoes_submissao ON public.china_doc_versoes(submissao_id);

ALTER TABLE public.china_doc_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read china_doc_versoes"
ON public.china_doc_versoes FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert china_doc_versoes"
ON public.china_doc_versoes FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Sem UPDATE/DELETE para usuário comum (trilha imutável). Admins podem usar service role.

-- Estende china_doc_revisoes com anexos e tradução
ALTER TABLE public.china_doc_revisoes
  ADD COLUMN IF NOT EXISTS anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS motivo_idioma_origem text,
  ADD COLUMN IF NOT EXISTS motivo_traducoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contestacao_idioma_origem text,
  ADD COLUMN IF NOT EXISTS contestacao_traducoes jsonb NOT NULL DEFAULT '{}'::jsonb;