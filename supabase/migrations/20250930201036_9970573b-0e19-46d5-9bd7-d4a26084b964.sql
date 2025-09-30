-- Criar tabela de planos
CREATE TABLE public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  preco DECIMAL(10,2) NOT NULL DEFAULT 0,
  limites JSONB NOT NULL DEFAULT '{}',
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de assinaturas
CREATE TABLE public.assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_id UUID NOT NULL REFERENCES public.planos(id) ON DELETE RESTRICT,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_fim TIMESTAMP WITH TIME ZONE,
  cancelado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, plano_id)
);

-- Adicionar coluna plano_id na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN plano_id UUID REFERENCES public.planos(id);

-- Criar índices para melhor performance
CREATE INDEX idx_assinaturas_usuario_id ON public.assinaturas(usuario_id);
CREATE INDEX idx_assinaturas_plano_id ON public.assinaturas(plano_id);
CREATE INDEX idx_assinaturas_status ON public.assinaturas(status);
CREATE INDEX idx_profiles_plano_id ON public.profiles(plano_id);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para planos (todos podem visualizar)
CREATE POLICY "Todos podem visualizar planos ativos"
ON public.planos FOR SELECT
USING (ativo = true);

-- Apenas admins podem gerenciar planos
CREATE POLICY "Admins podem gerenciar planos"
ON public.planos FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND tipo_usuario = 'admin'
  )
);

-- Políticas RLS para assinaturas (usuários podem ver suas próprias)
CREATE POLICY "Usuários podem ver suas assinaturas"
ON public.assinaturas FOR SELECT
USING (usuario_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

-- Admins e supervisores podem gerenciar assinaturas
CREATE POLICY "Admins e supervisores podem gerenciar assinaturas"
ON public.assinaturas FOR ALL
USING (is_admin_or_supervisor(auth.uid()));

-- Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_assinatura_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar timestamps
CREATE TRIGGER update_planos_updated_at
BEFORE UPDATE ON public.planos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assinaturas_updated_at
BEFORE UPDATE ON public.assinaturas
FOR EACH ROW EXECUTE FUNCTION update_assinatura_timestamp();

-- Inserir planos padrão
INSERT INTO public.planos (nome, descricao, preco, limites, ativo) VALUES
('Básico', 'Plano gratuito com funcionalidades limitadas', 0, 
  '{"max_prospects": 10, "max_atividades": 50, "relatorios_avancados": false, "chat_ai": false, "api_access": false}', 
  true),
('Premium', 'Plano pago com funcionalidades expandidas', 99.90, 
  '{"max_prospects": 100, "max_atividades": 500, "relatorios_avancados": true, "chat_ai": true, "api_access": false}', 
  true),
('Enterprise', 'Plano completo com recursos ilimitados', 299.90, 
  '{"max_prospects": -1, "max_atividades": -1, "relatorios_avancados": true, "chat_ai": true, "api_access": true}', 
  true);

-- Atribuir plano básico para todos os usuários existentes
UPDATE public.profiles 
SET plano_id = (SELECT id FROM public.planos WHERE nome = 'Básico' LIMIT 1)
WHERE plano_id IS NULL;