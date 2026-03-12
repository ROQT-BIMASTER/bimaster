
-- Tabela de cadastro de produtos Brasil (vinculado à submissão China)
CREATE TABLE public.produtos_brasil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_china_id uuid REFERENCES public.china_produto_submissoes(id) ON DELETE SET NULL,
  vinculo_id uuid REFERENCES public.china_submissao_tarefa_vinculos(id) ON DELETE SET NULL,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  -- Dados China (snapshot, read-only na UI)
  china_nome text,
  china_codigo text,
  china_ean text,
  china_categoria text,
  china_descricao text,
  -- Dados Brasil (editáveis)
  nome_brasil text,
  codigo_brasil text,
  categoria_brasil text,
  descricao_brasil text,
  observacoes text,
  -- Status do fluxo
  status text NOT NULL DEFAULT 'aguardando_precadastro',
  responsavel_precadastro_id uuid,
  responsavel_regulatorio_id uuid,
  -- Regulatório
  numero_registro text,
  status_anvisa text,
  categoria_regulatoria text,
  responsavel_tecnico text,
  data_aprovacao_regulatorio date,
  -- Audit
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.produtos_brasil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view produtos_brasil"
  ON public.produtos_brasil FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert produtos_brasil"
  ON public.produtos_brasil FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update produtos_brasil"
  ON public.produtos_brasil FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Tabela de SKUs/variações do produto Brasil
CREATE TABLE public.produto_brasil_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid NOT NULL REFERENCES public.produtos_brasil(id) ON DELETE CASCADE,
  cor text,
  tamanho_grade text,
  codigo_interno text,
  ean text,
  quantidade_inicial integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.produto_brasil_skus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage produto_brasil_skus"
  ON public.produto_brasil_skus FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Checklist regulatório do produto Brasil
CREATE TABLE public.produto_brasil_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid NOT NULL REFERENCES public.produtos_brasil(id) ON DELETE CASCADE,
  item text NOT NULL,
  concluido boolean DEFAULT false,
  concluido_por uuid,
  concluido_em timestamptz,
  observacao text
);

ALTER TABLE public.produto_brasil_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage produto_brasil_checklist"
  ON public.produto_brasil_checklist FOR ALL TO authenticated USING (true) WITH CHECK (true);
