
-- Tabela de regras de metas do calendário
CREATE TABLE public.projeto_calendario_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'percentual_conclusao',
  operador TEXT NOT NULL DEFAULT '>=',
  valor NUMERIC NOT NULL DEFAULT 80,
  periodo TEXT NOT NULL DEFAULT 'mensal',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_calendario_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage regras" ON public.projeto_calendario_regras
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela de planos de ação
CREATE TABLE public.projeto_planos_acao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio DATE,
  data_fim DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  responsavel_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_planos_acao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage planos" ON public.projeto_planos_acao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
