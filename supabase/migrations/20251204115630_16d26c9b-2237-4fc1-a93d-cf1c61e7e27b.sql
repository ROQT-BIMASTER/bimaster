
-- Tabela principal de lançamentos de produtos
CREATE TABLE public.lancamentos_produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID REFERENCES public.fabrica_produtos(id) ON DELETE SET NULL,
  nome_lancamento VARCHAR(255) NOT NULL,
  descricao TEXT,
  data_prevista DATE NOT NULL,
  data_efetiva DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'planejado',
  tipo VARCHAR(50) NOT NULL DEFAULT 'novo_produto',
  prioridade VARCHAR(20) NOT NULL DEFAULT 'media',
  tabela_preco_id UUID REFERENCES public.fabrica_tabelas_preco(id) ON DELETE SET NULL,
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT lancamentos_status_check CHECK (status IN ('planejado', 'em_preparacao', 'aprovado', 'lancado', 'cancelado')),
  CONSTRAINT lancamentos_tipo_check CHECK (tipo IN ('novo_produto', 'reformulacao', 'nova_versao', 'promocional')),
  CONSTRAINT lancamentos_prioridade_check CHECK (prioridade IN ('alta', 'media', 'baixa'))
);

-- Tabela de relacionamento com distribuidores
CREATE TABLE public.lancamentos_distribuidores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lancamento_id UUID NOT NULL REFERENCES public.lancamentos_produtos(id) ON DELETE CASCADE,
  distribuidora_id UUID NOT NULL REFERENCES public.estoque_distribuidoras(id) ON DELETE CASCADE,
  data_comunicacao DATE,
  status_comunicacao VARCHAR(50) DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT lancamentos_dist_status_check CHECK (status_comunicacao IN ('pendente', 'enviado', 'confirmado'))
);

-- Tabela de tarefas de marketing
CREATE TABLE public.lancamentos_tarefas_marketing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lancamento_id UUID NOT NULL REFERENCES public.lancamentos_produtos(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) NOT NULL,
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_prazo DATE,
  data_conclusao DATE,
  status VARCHAR(50) DEFAULT 'pendente',
  arquivos_urls TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT tarefas_tipo_check CHECK (tipo IN ('post_social', 'catalogo', 'ficha_tecnica', 'banner', 'video', 'email_marketing', 'stories', 'outro')),
  CONSTRAINT tarefas_status_check CHECK (status IN ('pendente', 'em_andamento', 'revisao', 'concluido'))
);

-- Tabela de materiais do lançamento
CREATE TABLE public.lancamentos_materiais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lancamento_id UUID NOT NULL REFERENCES public.lancamentos_produtos(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  versao INTEGER DEFAULT 1,
  aprovado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT materiais_tipo_check CHECK (tipo IN ('foto_produto', 'catalogo_pdf', 'ficha_tecnica', 'apresentacao', 'video', 'outro'))
);

-- Índices para performance
CREATE INDEX idx_lancamentos_status ON public.lancamentos_produtos(status);
CREATE INDEX idx_lancamentos_data_prevista ON public.lancamentos_produtos(data_prevista);
CREATE INDEX idx_lancamentos_produto ON public.lancamentos_produtos(produto_id);
CREATE INDEX idx_lancamentos_dist_lancamento ON public.lancamentos_distribuidores(lancamento_id);
CREATE INDEX idx_lancamentos_tarefas_lancamento ON public.lancamentos_tarefas_marketing(lancamento_id);
CREATE INDEX idx_lancamentos_tarefas_status ON public.lancamentos_tarefas_marketing(status);

-- Enable RLS
ALTER TABLE public.lancamentos_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_distribuidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_tarefas_marketing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_materiais ENABLE ROW LEVEL SECURITY;

-- Policies para lancamentos_produtos
CREATE POLICY "Usuários fabrica podem ver lançamentos" ON public.lancamentos_produtos
  FOR SELECT USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica') OR usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

CREATE POLICY "Usuários fabrica podem criar lançamentos" ON public.lancamentos_produtos
  FOR INSERT WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem atualizar lançamentos" ON public.lancamentos_produtos
  FOR UPDATE USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Admins podem deletar lançamentos" ON public.lancamentos_produtos
  FOR DELETE USING (is_admin_or_supervisor(auth.uid()));

-- Policies para lancamentos_distribuidores
CREATE POLICY "Usuários autorizados podem ver dist lançamentos" ON public.lancamentos_distribuidores
  FOR SELECT USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica') OR usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

CREATE POLICY "Usuários fabrica podem gerenciar dist lançamentos" ON public.lancamentos_distribuidores
  FOR ALL USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- Policies para lancamentos_tarefas_marketing
CREATE POLICY "Usuários autorizados podem ver tarefas" ON public.lancamentos_tarefas_marketing
  FOR SELECT USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica') OR usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

CREATE POLICY "Usuários fabrica podem criar tarefas" ON public.lancamentos_tarefas_marketing
  FOR INSERT WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários marketing podem atualizar tarefas" ON public.lancamentos_tarefas_marketing
  FOR UPDATE USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica') OR usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

CREATE POLICY "Admins podem deletar tarefas" ON public.lancamentos_tarefas_marketing
  FOR DELETE USING (is_admin_or_supervisor(auth.uid()));

-- Policies para lancamentos_materiais
CREATE POLICY "Usuários autorizados podem ver materiais" ON public.lancamentos_materiais
  FOR SELECT USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica') OR usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

CREATE POLICY "Usuários fabrica/marketing podem gerenciar materiais" ON public.lancamentos_materiais
  FOR ALL USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica') OR usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

-- Trigger para updated_at
CREATE TRIGGER update_lancamentos_produtos_updated_at
  BEFORE UPDATE ON public.lancamentos_produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lancamentos_tarefas_updated_at
  BEFORE UPDATE ON public.lancamentos_tarefas_marketing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
