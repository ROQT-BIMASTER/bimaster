
CREATE TABLE china_documento_tarefa_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES china_produto_documentos(id) ON DELETE CASCADE,
  tarefa_id UUID NOT NULL,
  secao_id UUID REFERENCES projeto_secoes(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(documento_id, tarefa_id)
);

ALTER TABLE china_documento_tarefa_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage doc vinculos"
  ON china_documento_tarefa_vinculos
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
