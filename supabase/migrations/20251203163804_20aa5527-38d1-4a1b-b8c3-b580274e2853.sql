-- Tabela para marcação de contas para revisão e redução de gastos
CREATE TABLE public.contas_pagar_revisao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID REFERENCES contas_pagar(id) ON DELETE SET NULL,
  plano_contas_id UUID REFERENCES trade_chart_of_accounts(id) ON DELETE SET NULL,
  departamento_id UUID REFERENCES departamentos(id) ON DELETE SET NULL,
  categoria_nome TEXT,
  tipo_revisao TEXT NOT NULL CHECK (tipo_revisao IN ('eliminar', 'reduzir', 'renegociar', 'monitorar')),
  prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('alta', 'media', 'baixa')),
  meta_reducao_percentual NUMERIC(5,2),
  meta_reducao_valor NUMERIC(15,2),
  valor_atual NUMERIC(15,2),
  responsavel_id UUID,
  prazo_revisao DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'cancelado')),
  observacoes TEXT,
  resultado_obtido NUMERIC(15,2),
  criado_por UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX idx_contas_pagar_revisao_status ON contas_pagar_revisao(status);
CREATE INDEX idx_contas_pagar_revisao_responsavel ON contas_pagar_revisao(responsavel_id);
CREATE INDEX idx_contas_pagar_revisao_prioridade ON contas_pagar_revisao(prioridade);
CREATE INDEX idx_contas_pagar_revisao_plano_contas ON contas_pagar_revisao(plano_contas_id);
CREATE INDEX idx_contas_pagar_revisao_departamento ON contas_pagar_revisao(departamento_id);

-- RLS
ALTER TABLE public.contas_pagar_revisao ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins e supervisores podem ver todas as revisões"
ON public.contas_pagar_revisao FOR SELECT
USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários podem ver revisões que são responsáveis"
ON public.contas_pagar_revisao FOR SELECT
USING (responsavel_id = auth.uid());

CREATE POLICY "Admins e supervisores podem criar revisões"
ON public.contas_pagar_revisao FOR INSERT
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores podem atualizar revisões"
ON public.contas_pagar_revisao FOR UPDATE
USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Responsáveis podem atualizar suas revisões"
ON public.contas_pagar_revisao FOR UPDATE
USING (responsavel_id = auth.uid());

CREATE POLICY "Admins podem deletar revisões"
ON public.contas_pagar_revisao FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contas_pagar_revisao_updated_at
BEFORE UPDATE ON public.contas_pagar_revisao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();