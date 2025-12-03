-- Tabela para eventos de monitoramento de revisões
CREATE TABLE public.revisao_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  revisao_id UUID NOT NULL REFERENCES contas_pagar_revisao(id) ON DELETE CASCADE,
  tipo_evento VARCHAR(50) NOT NULL DEFAULT 'observacao',
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  data_evento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_lembrete TIMESTAMP WITH TIME ZONE,
  valor_referencia NUMERIC(15,2),
  concluido BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_revisao_eventos_revisao ON revisao_eventos(revisao_id);
CREATE INDEX idx_revisao_eventos_data ON revisao_eventos(data_evento DESC);
CREATE INDEX idx_revisao_eventos_lembrete ON revisao_eventos(data_lembrete) WHERE data_lembrete IS NOT NULL AND concluido = false;

-- Enable RLS
ALTER TABLE revisao_eventos ENABLE ROW LEVEL SECURITY;

-- Policies (admin/supervisor podem tudo)
CREATE POLICY "Admins e supervisores podem ver eventos"
  ON revisao_eventos FOR SELECT
  USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores podem criar eventos"
  ON revisao_eventos FOR INSERT
  WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores podem atualizar eventos"
  ON revisao_eventos FOR UPDATE
  USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores podem deletar eventos"
  ON revisao_eventos FOR DELETE
  USING (public.is_admin_or_supervisor(auth.uid()));

-- Comentários
COMMENT ON TABLE revisao_eventos IS 'Eventos e observações de monitoramento de revisões de gastos';
COMMENT ON COLUMN revisao_eventos.tipo_evento IS 'Tipos: observacao, lembrete, renegociacao, contato, vencimento';