-- Tabela para tipos de brinde dinâmicos
CREATE TABLE public.trade_tipos_brinde (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.trade_tipos_brinde ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Todos autenticados podem ver tipos de brinde ativos"
  ON public.trade_tipos_brinde FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins podem criar tipos de brinde"
  ON public.trade_tipos_brinde FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins podem atualizar tipos de brinde"
  ON public.trade_tipos_brinde FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Inserir opções padrão
INSERT INTO public.trade_tipos_brinde (codigo, nome, descricao) VALUES
  ('brinde_produto', 'Brinde Produto', 'Brinde em forma de produto'),
  ('desconto', 'Desconto', 'Desconto aplicado na compra'),
  ('bonificacao', 'Bonificação', 'Bonificação em produtos'),
  ('kit_promocional', 'Kit Promocional', 'Kit promocional especial'),
  ('premio', 'Prêmio', 'Prêmio de campanha'),
  ('outro', 'Outro', 'Outros tipos de brinde');