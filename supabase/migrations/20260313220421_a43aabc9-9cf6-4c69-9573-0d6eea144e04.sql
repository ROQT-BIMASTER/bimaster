
-- Tabela de composição de ingredientes
CREATE TABLE public.produto_composicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  nome_chines text,
  inci_name text NOT NULL,
  cas_no text,
  funcao text NOT NULL DEFAULT 'outros',
  percentual_por_cor jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_anvisa text NOT NULL DEFAULT 'pendente',
  observacao_anvisa text,
  aprovado_por uuid,
  data_aprovacao timestamptz,
  justificativa_correcao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de versões da composição
CREATE TABLE public.produto_composicao_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE NOT NULL,
  versao integer NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  submetido_por uuid,
  submetido_em timestamptz,
  aprovado_por uuid,
  aprovado_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Gate de liberação para criação
CREATE TABLE public.produto_gate_criacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE NOT NULL UNIQUE,
  composicao_ok boolean NOT NULL DEFAULT false,
  composicao_aprovada_por uuid,
  composicao_aprovada_em timestamptz,
  arte_primaria_ok boolean NOT NULL DEFAULT false,
  arte_aprovada_por uuid,
  arte_aprovada_em timestamptz,
  pacote_liberado boolean NOT NULL DEFAULT false,
  pacote_liberado_em timestamptz,
  notificacao_criacao_enviada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de peticionamento ANVISA
CREATE TABLE public.produto_peticionamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE NOT NULL,
  documento_composicao_id uuid REFERENCES public.produto_composicao_versoes(id),
  documento_embalagem_id uuid REFERENCES public.china_produto_documentos(id),
  tipo_grau text NOT NULL DEFAULT 'grau_1',
  numero_processo text,
  data_envio timestamptz,
  data_aprovacao timestamptz,
  taxa numeric(12,2),
  status text NOT NULL DEFAULT 'aguardando_dossie',
  observacoes text,
  criado_por uuid,
  checklist_composicao_ok boolean NOT NULL DEFAULT false,
  checklist_embalagem_ok boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.produto_composicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_composicao_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_gate_criacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_peticionamento ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users
CREATE POLICY "Authenticated users can manage composicao" ON public.produto_composicao FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage composicao_versoes" ON public.produto_composicao_versoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage gate_criacao" ON public.produto_gate_criacao FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage peticionamento" ON public.produto_peticionamento FOR ALL TO authenticated USING (true) WITH CHECK (true);
