-- Tabela para armazenar tarefas de ajuste de preço reverso
CREATE TABLE public.fabrica_tarefas_ajuste_preco (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE,
  tabela_id UUID NOT NULL REFERENCES public.fabrica_tabelas_preco(id) ON DELETE CASCADE,
  tabela_limite_id UUID NOT NULL REFERENCES public.fabrica_tabelas_preco(id) ON DELETE CASCADE,
  preco_atual NUMERIC(15,4) NOT NULL,
  preco_sugerido NUMERIC(15,4) NOT NULL,
  diferenca_percentual NUMERIC(10,2),
  margem_resultante NUMERIC(10,2),
  custo_base NUMERIC(15,4),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'aplicada', 'rejeitada')),
  ordem_na_cadeia INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  aprovada_por UUID REFERENCES auth.users(id),
  aprovada_em TIMESTAMP WITH TIME ZONE,
  aplicada_por UUID REFERENCES auth.users(id),
  aplicada_em TIMESTAMP WITH TIME ZONE,
  rejeitada_por UUID REFERENCES auth.users(id),
  rejeitada_em TIMESTAMP WITH TIME ZONE,
  motivo_rejeicao TEXT,
  
  -- Índices para busca eficiente
  CONSTRAINT fk_produto FOREIGN KEY (produto_id) REFERENCES public.fabrica_produtos(id),
  CONSTRAINT fk_tabela FOREIGN KEY (tabela_id) REFERENCES public.fabrica_tabelas_preco(id),
  CONSTRAINT fk_tabela_limite FOREIGN KEY (tabela_limite_id) REFERENCES public.fabrica_tabelas_preco(id)
);

-- Índices para performance
CREATE INDEX idx_tarefas_ajuste_status ON public.fabrica_tarefas_ajuste_preco(status);
CREATE INDEX idx_tarefas_ajuste_tabela ON public.fabrica_tarefas_ajuste_preco(tabela_id);
CREATE INDEX idx_tarefas_ajuste_produto ON public.fabrica_tarefas_ajuste_preco(produto_id);
CREATE INDEX idx_tarefas_ajuste_tabela_limite ON public.fabrica_tarefas_ajuste_preco(tabela_limite_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_fabrica_tarefas_ajuste_preco_updated_at
  BEFORE UPDATE ON public.fabrica_tarefas_ajuste_preco
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.fabrica_tarefas_ajuste_preco ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários autenticados podem ver tarefas de ajuste"
  ON public.fabrica_tarefas_ajuste_preco
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar tarefas de ajuste"
  ON public.fabrica_tarefas_ajuste_preco
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar tarefas de ajuste"
  ON public.fabrica_tarefas_ajuste_preco
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem deletar tarefas de ajuste"
  ON public.fabrica_tarefas_ajuste_preco
  FOR DELETE
  TO authenticated
  USING (true);

-- Comentários
COMMENT ON TABLE public.fabrica_tarefas_ajuste_preco IS 'Tarefas de ajuste de preço reverso para quando um limite é definido';
COMMENT ON COLUMN public.fabrica_tarefas_ajuste_preco.ordem_na_cadeia IS 'Posição da tabela na cadeia de precificação (0 = mais próxima do limite)';