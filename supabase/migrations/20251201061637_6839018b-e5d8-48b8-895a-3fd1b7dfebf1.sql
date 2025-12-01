-- Criar tabela de departamentos
CREATE TABLE IF NOT EXISTS public.departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  responsavel_id UUID REFERENCES auth.users(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de mapeamento categoria → departamento
CREATE TABLE IF NOT EXISTS public.categoria_departamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_nome TEXT NOT NULL,
  departamento_id UUID NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(categoria_nome)
);

-- Criar tabela de verbas orçamentárias
CREATE TABLE IF NOT EXISTS public.verbas_orcamentarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_id UUID NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  valor_orcado DECIMAL(15,2) NOT NULL DEFAULT 0,
  valor_realizado DECIMAL(15,2) DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(departamento_id, ano, mes)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_categoria_depto_categoria ON public.categoria_departamento(categoria_nome);
CREATE INDEX IF NOT EXISTS idx_verbas_depto_periodo ON public.verbas_orcamentarias(departamento_id, ano, mes);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_departamentos_updated_at
  BEFORE UPDATE ON public.departamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verbas_updated_at
  BEFORE UPDATE ON public.verbas_orcamentarias
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categoria_departamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verbas_orcamentarias ENABLE ROW LEVEL SECURITY;

-- Políticas para departamentos
CREATE POLICY "Usuários autenticados podem ver departamentos"
  ON public.departamentos FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar departamentos"
  ON public.departamentos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar departamentos"
  ON public.departamentos FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Políticas para categoria_departamento
CREATE POLICY "Usuários autenticados podem ver mapeamento categoria-departamento"
  ON public.categoria_departamento FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar mapeamento categoria-departamento"
  ON public.categoria_departamento FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar mapeamento categoria-departamento"
  ON public.categoria_departamento FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar mapeamento categoria-departamento"
  ON public.categoria_departamento FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Políticas para verbas_orcamentarias
CREATE POLICY "Usuários autenticados podem ver verbas orçamentárias"
  ON public.verbas_orcamentarias FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar verbas orçamentárias"
  ON public.verbas_orcamentarias FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar verbas orçamentárias"
  ON public.verbas_orcamentarias FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar verbas orçamentárias"
  ON public.verbas_orcamentarias FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Inserir departamentos padrão
INSERT INTO public.departamentos (nome, descricao, ativo) VALUES
  ('Recursos Humanos', 'Gestão de pessoas e folha de pagamento', true),
  ('Financeiro', 'Gestão financeira e contábil', true),
  ('Comercial', 'Vendas e relacionamento com clientes', true),
  ('Marketing', 'Comunicação e marketing', true),
  ('Operações', 'Operações e produção', true),
  ('TI', 'Tecnologia da Informação', true),
  ('Administrativo', 'Serviços administrativos', true)
ON CONFLICT (nome) DO NOTHING;