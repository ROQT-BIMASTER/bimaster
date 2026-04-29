-- Tabela para registrar itens padrão do checklist ocultos por submissão
CREATE TABLE public.china_checklist_itens_ocultos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  tipo_key text NOT NULL,
  hidden_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submissao_id, tipo_key)
);

CREATE INDEX idx_china_checklist_itens_ocultos_submissao ON public.china_checklist_itens_ocultos(submissao_id);

ALTER TABLE public.china_checklist_itens_ocultos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage hidden checklist items"
  ON public.china_checklist_itens_ocultos
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);