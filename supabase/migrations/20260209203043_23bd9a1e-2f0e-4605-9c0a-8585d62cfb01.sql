
-- Bucket para evidências de custos de insumos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('fabrica-custo-evidencias', 'fabrica-custo-evidencias', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket
CREATE POLICY "Authenticated users can view cost evidence files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'fabrica-custo-evidencias');

CREATE POLICY "Authenticated users can upload cost evidence files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fabrica-custo-evidencias');

CREATE POLICY "Authenticated users can delete own cost evidence files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fabrica-custo-evidencias');

-- Tabela para vincular evidências aos apontamentos/insumos
CREATE TABLE public.fabrica_custo_evidencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_custo_id UUID REFERENCES public.fabrica_produto_custos(id) ON DELETE CASCADE,
  revisao_item_id UUID,
  produto_id UUID NOT NULL,
  nome_arquivo TEXT NOT NULL,
  url_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT,
  tamanho_bytes BIGINT,
  descricao TEXT,
  usuario_id UUID,
  usuario_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_fabrica_custo_evidencias_produto_custo ON public.fabrica_custo_evidencias(produto_custo_id);
CREATE INDEX idx_fabrica_custo_evidencias_produto ON public.fabrica_custo_evidencias(produto_id);

ALTER TABLE public.fabrica_custo_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cost evidence"
ON public.fabrica_custo_evidencias FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert cost evidence"
ON public.fabrica_custo_evidencias FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete cost evidence"
ON public.fabrica_custo_evidencias FOR DELETE TO authenticated USING (true);
