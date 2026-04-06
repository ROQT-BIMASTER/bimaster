
CREATE TABLE revisao_orcamentos_alternativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id UUID REFERENCES contas_pagar_revisao(id) ON DELETE CASCADE NOT NULL,
  fornecedor_nome TEXT NOT NULL,
  valor_proposta NUMERIC(15,2) NOT NULL,
  descricao TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  validade DATE,
  selecionado BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE revisao_orcamentos_alternativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage orcamentos alternativos"
  ON revisao_orcamentos_alternativos
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('revisao-orcamentos', 'revisao-orcamentos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload revisao orcamentos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'revisao-orcamentos');

CREATE POLICY "Authenticated users can read revisao orcamentos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'revisao-orcamentos');

CREATE POLICY "Authenticated users can delete revisao orcamentos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'revisao-orcamentos');
