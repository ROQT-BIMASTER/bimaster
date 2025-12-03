-- Tabela para histórico de alterações em contas_pagar
CREATE TABLE public.contas_pagar_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES public.contas_pagar(id) ON DELETE CASCADE,
  campo_alterado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  tipo_alteracao TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'ia', 'sistema'
  justificativa TEXT,
  usuario_id UUID REFERENCES auth.users(id),
  usuario_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_contas_pagar_historico_conta_id ON public.contas_pagar_historico(conta_id);
CREATE INDEX idx_contas_pagar_historico_created_at ON public.contas_pagar_historico(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.contas_pagar_historico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários autenticados podem visualizar histórico"
ON public.contas_pagar_historico
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem inserir histórico"
ON public.contas_pagar_historico
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Adicionar campo de justificativa na contas_pagar se não existir
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS classificacao_justificativa TEXT;

-- Comentários
COMMENT ON TABLE public.contas_pagar_historico IS 'Registro de todas as alterações feitas em lançamentos de contas a pagar';
COMMENT ON COLUMN public.contas_pagar_historico.tipo_alteracao IS 'Tipo da alteração: manual (usuário), ia (sugestão IA aceita), sistema (automático)';