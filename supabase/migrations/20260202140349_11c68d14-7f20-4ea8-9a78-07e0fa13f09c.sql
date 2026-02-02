-- Tabela de histórico de alterações para campanhas e lançamentos
CREATE TABLE IF NOT EXISTS public.trade_campaign_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('campaign', 'lancamento')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  reason TEXT,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_trade_audit_entity ON public.trade_campaign_audit_log(entity_type, entity_id);
CREATE INDEX idx_trade_audit_user ON public.trade_campaign_audit_log(user_id);
CREATE INDEX idx_trade_audit_created ON public.trade_campaign_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.trade_campaign_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view audit logs" 
ON public.trade_campaign_audit_log 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert audit logs" 
ON public.trade_campaign_audit_log 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Adicionar coluna deleted_at nas tabelas existentes para soft delete
ALTER TABLE public.trade_campaigns 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE public.trade_campaign_lancamentos 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Atualizar índice para excluir itens deletados por padrão
CREATE INDEX IF NOT EXISTS idx_campaigns_not_deleted ON public.trade_campaigns(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lancamentos_not_deleted ON public.trade_campaign_lancamentos(id) WHERE deleted_at IS NULL;