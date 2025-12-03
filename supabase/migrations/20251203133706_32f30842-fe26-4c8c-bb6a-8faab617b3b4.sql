-- Tabela para alertas de preços
CREATE TABLE IF NOT EXISTS public.fabrica_alertas_precos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela_id UUID REFERENCES public.fabrica_tabelas_preco(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE,
  tipo_alerta TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  severidade TEXT NOT NULL DEFAULT 'warning',
  dados_alerta JSONB DEFAULT '{}',
  lido BOOLEAN DEFAULT false,
  resolvido BOOLEAN DEFAULT false,
  resolvido_em TIMESTAMP WITH TIME ZONE,
  resolvido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fabrica_alertas_precos_tabela ON public.fabrica_alertas_precos(tabela_id);
CREATE INDEX IF NOT EXISTS idx_fabrica_alertas_precos_tipo ON public.fabrica_alertas_precos(tipo_alerta);
CREATE INDEX IF NOT EXISTS idx_fabrica_alertas_precos_resolvido ON public.fabrica_alertas_precos(resolvido);

-- Enable RLS
ALTER TABLE public.fabrica_alertas_precos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos podem visualizar alertas de preços"
  ON public.fabrica_alertas_precos FOR SELECT
  USING (true);

CREATE POLICY "Usuários autenticados podem gerenciar alertas de preços"
  ON public.fabrica_alertas_precos FOR ALL
  USING (auth.uid() IS NOT NULL);