
CREATE TABLE public.processo_documento_recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.china_produto_documentos(id) ON DELETE CASCADE,
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  confirmado_por uuid NOT NULL,
  confirmado_em timestamptz NOT NULL DEFAULT now(),
  observacao text,
  UNIQUE(documento_id, confirmado_por)
);

ALTER TABLE public.processo_documento_recebimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select recebimentos"
  ON public.processo_documento_recebimentos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert recebimentos"
  ON public.processo_documento_recebimentos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = confirmado_por);
