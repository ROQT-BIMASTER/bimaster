
-- Tabela de cotações de matéria-prima
CREATE TABLE public.fabrica_mp_cotacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_custo_id uuid NOT NULL REFERENCES public.fabrica_produto_custos(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE,
  mp_id uuid NULL,
  fornecedor_nome text NOT NULL,
  valor_unitario numeric NOT NULL DEFAULT 0,
  condicao_pagamento text,
  validade date,
  observacoes text,
  arquivo_url text,
  arquivo_nome text,
  selecionada boolean NOT NULL DEFAULT false,
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para performance
CREATE INDEX idx_fabrica_mp_cotacoes_produto_custo ON public.fabrica_mp_cotacoes(produto_custo_id);
CREATE INDEX idx_fabrica_mp_cotacoes_produto ON public.fabrica_mp_cotacoes(produto_id);

-- RLS
ALTER TABLE public.fabrica_mp_cotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem ver cotacoes"
  ON public.fabrica_mp_cotacoes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem inserir cotacoes"
  ON public.fabrica_mp_cotacoes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem atualizar cotacoes"
  ON public.fabrica_mp_cotacoes FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem deletar cotacoes"
  ON public.fabrica_mp_cotacoes FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Bucket para arquivos de cotações (orçamentos PDF)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fabrica-cotacoes', 'fabrica-cotacoes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Cotacoes arquivos publicos leitura"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fabrica-cotacoes');

CREATE POLICY "Usuarios autenticados upload cotacoes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fabrica-cotacoes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados delete cotacoes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'fabrica-cotacoes' AND auth.uid() IS NOT NULL);
