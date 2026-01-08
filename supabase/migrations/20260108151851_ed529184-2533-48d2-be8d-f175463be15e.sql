-- Tabela de auditoria para alterações no plano de contas e DRE
CREATE TABLE IF NOT EXISTS public.plano_contas_auditoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID REFERENCES public.trade_chart_of_accounts(id),
  conta_codigo TEXT,
  conta_nome TEXT,
  campo_alterado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  tipo_alteracao TEXT NOT NULL, -- 'categoria_dre', 'departamento', 'reclassificacao', 'exclusao', 'criacao'
  justificativa TEXT,
  usuario_id UUID NOT NULL,
  usuario_email TEXT,
  usuario_nome TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Comentário na tabela
COMMENT ON TABLE public.plano_contas_auditoria IS 'Registro de auditoria para todas as alterações no plano de contas e classificações DRE';

-- Índices para buscas rápidas
CREATE INDEX idx_plano_contas_auditoria_conta_id ON public.plano_contas_auditoria(conta_id);
CREATE INDEX idx_plano_contas_auditoria_usuario_id ON public.plano_contas_auditoria(usuario_id);
CREATE INDEX idx_plano_contas_auditoria_created_at ON public.plano_contas_auditoria(created_at DESC);
CREATE INDEX idx_plano_contas_auditoria_tipo ON public.plano_contas_auditoria(tipo_alteracao);

-- Habilitar RLS
ALTER TABLE public.plano_contas_auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - apenas usuários autenticados podem ver e inserir
CREATE POLICY "Usuários autenticados podem ver auditoria"
ON public.plano_contas_auditoria
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem criar registros de auditoria"
ON public.plano_contas_auditoria
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = usuario_id);

-- Habilitar realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.plano_contas_auditoria;