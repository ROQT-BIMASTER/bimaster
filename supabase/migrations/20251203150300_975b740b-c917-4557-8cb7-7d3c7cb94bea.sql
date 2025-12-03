-- =============================================
-- MÓDULO DE GESTÃO DE ESTOQUE MULTIDISTRIBUIDORAS
-- =============================================

-- 1. TABELA: Distribuidoras
CREATE TABLE public.estoque_distribuidoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) UNIQUE NOT NULL,
  endereco TEXT,
  cidade VARCHAR(100),
  uf VARCHAR(2),
  telefone VARCHAR(20),
  email VARCHAR(255),
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. TABELA: Produtos Master (produto central para consolidação)
CREATE TABLE public.estoque_produtos_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  sku_master VARCHAR(50) UNIQUE NOT NULL,
  unidade_medida VARCHAR(20) NOT NULL DEFAULT 'UN',
  categoria VARCHAR(100),
  subcategoria VARCHAR(100),
  descricao TEXT,
  peso_liquido DECIMAL(10,3),
  peso_bruto DECIMAL(10,3),
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. TABELA: Produtos Distribuidora (vinculação produto ↔ distribuidora)
CREATE TABLE public.estoque_produtos_distribuidora (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_master_id UUID NOT NULL REFERENCES public.estoque_produtos_master(id) ON DELETE CASCADE,
  distribuidora_id UUID NOT NULL REFERENCES public.estoque_distribuidoras(id) ON DELETE CASCADE,
  codigo_produto_distribuidora VARCHAR(50) NOT NULL,
  nome_exibicao VARCHAR(255),
  fator_conversao DECIMAL(10,4) DEFAULT 1.0,
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(distribuidora_id, codigo_produto_distribuidora)
);

-- 4. TABELA: Saldos de Estoque
CREATE TABLE public.estoque_saldos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidora_id UUID NOT NULL REFERENCES public.estoque_distribuidoras(id) ON DELETE CASCADE,
  produto_distribuidora_id UUID NOT NULL REFERENCES public.estoque_produtos_distribuidora(id) ON DELETE CASCADE,
  quantidade_disponivel DECIMAL(15,4) NOT NULL DEFAULT 0,
  quantidade_reservada DECIMAL(15,4) DEFAULT 0,
  localizacao VARCHAR(100),
  lote VARCHAR(50),
  data_validade DATE,
  custo_medio DECIMAL(15,4),
  ultimo_movimento TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(distribuidora_id, produto_distribuidora_id, lote)
);

-- 5. TABELA: Movimentações de Estoque
CREATE TABLE public.estoque_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estoque_id UUID NOT NULL REFERENCES public.estoque_saldos(id) ON DELETE CASCADE,
  tipo_movimento VARCHAR(20) NOT NULL CHECK (tipo_movimento IN ('entrada', 'saida', 'transferencia', 'ajuste', 'inventario')),
  origem VARCHAR(255),
  destino VARCHAR(255),
  quantidade DECIMAL(15,4) NOT NULL,
  quantidade_anterior DECIMAL(15,4) NOT NULL,
  quantidade_nova DECIMAL(15,4) NOT NULL,
  custo_unitario DECIMAL(15,4),
  valor_total DECIMAL(15,2),
  documento_referencia VARCHAR(100),
  observacao TEXT,
  n8n_transaction_id VARCHAR(100),
  usuario_id UUID REFERENCES auth.users(id),
  data_movimento TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. TABELA: Logs de Sincronização N8N
CREATE TABLE public.estoque_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processando',
  registros_enviados INTEGER DEFAULT 0,
  registros_processados INTEGER DEFAULT 0,
  registros_erro INTEGER DEFAULT 0,
  erros JSONB DEFAULT '[]'::jsonb,
  detalhes JSONB DEFAULT '{}'::jsonb,
  ip_origem VARCHAR(45),
  duracao_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================
CREATE INDEX idx_estoque_distribuidoras_ativo ON public.estoque_distribuidoras(ativo);
CREATE INDEX idx_estoque_distribuidoras_cnpj ON public.estoque_distribuidoras(cnpj);
CREATE INDEX idx_estoque_produtos_master_sku ON public.estoque_produtos_master(sku_master);
CREATE INDEX idx_estoque_produtos_master_categoria ON public.estoque_produtos_master(categoria);
CREATE INDEX idx_estoque_produtos_distribuidora_codigo ON public.estoque_produtos_distribuidora(codigo_produto_distribuidora);
CREATE INDEX idx_estoque_produtos_distribuidora_master ON public.estoque_produtos_distribuidora(produto_master_id);
CREATE INDEX idx_estoque_saldos_distribuidora ON public.estoque_saldos(distribuidora_id);
CREATE INDEX idx_estoque_saldos_produto ON public.estoque_saldos(produto_distribuidora_id);
CREATE INDEX idx_estoque_saldos_lote ON public.estoque_saldos(lote);
CREATE INDEX idx_estoque_movimentacoes_estoque ON public.estoque_movimentacoes(estoque_id);
CREATE INDEX idx_estoque_movimentacoes_data ON public.estoque_movimentacoes(data_movimento);
CREATE INDEX idx_estoque_movimentacoes_tipo ON public.estoque_movimentacoes(tipo_movimento);
CREATE INDEX idx_estoque_movimentacoes_n8n ON public.estoque_movimentacoes(n8n_transaction_id);
CREATE INDEX idx_estoque_sync_logs_status ON public.estoque_sync_logs(status);
CREATE INDEX idx_estoque_sync_logs_created ON public.estoque_sync_logs(created_at);

-- =============================================
-- FUNÇÕES DE SEGURANÇA
-- =============================================

-- Função para verificar permissão no módulo estoque
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_estoque(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT public.usuario_tem_permissao_modulo(_user_id, 'estoque')
    OR public.has_role(_user_id, 'admin');
$$;

-- Função para impedir alteração direta no saldo (só via movimentação)
CREATE OR REPLACE FUNCTION public.validar_alteracao_saldo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Permite apenas se a alteração vier do trigger de movimentação
  IF TG_OP = 'UPDATE' AND OLD.quantidade_disponivel IS DISTINCT FROM NEW.quantidade_disponivel THEN
    -- Verifica se está sendo chamado pelo trigger de movimentação
    IF NOT current_setting('estoque.alteracao_via_movimentacao', true)::boolean THEN
      RAISE EXCEPTION 'Saldo de estoque só pode ser alterado via movimentação. Use a tabela estoque_movimentacoes.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para validar estoque negativo
CREATE OR REPLACE FUNCTION public.validar_estoque_negativo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.quantidade_nova < 0 THEN
    RAISE EXCEPTION 'Operação resultaria em estoque negativo. Saldo atual: %, Quantidade solicitada: %', 
      NEW.quantidade_anterior, NEW.quantidade;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para atualizar saldo após movimentação
CREATE OR REPLACE FUNCTION public.atualizar_saldo_apos_movimentacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Seta flag para permitir alteração do saldo
  PERFORM set_config('estoque.alteracao_via_movimentacao', 'true', true);
  
  -- Atualiza o saldo
  UPDATE public.estoque_saldos
  SET 
    quantidade_disponivel = NEW.quantidade_nova,
    ultimo_movimento = NEW.data_movimento,
    updated_at = now()
  WHERE id = NEW.estoque_id;
  
  -- Remove a flag
  PERFORM set_config('estoque.alteracao_via_movimentacao', 'false', true);
  
  RETURN NEW;
END;
$$;

-- Função para consulta consolidada por produto master
CREATE OR REPLACE FUNCTION public.get_estoque_consolidado_por_produto_master()
RETURNS TABLE (
  produto_master_id UUID,
  sku_master VARCHAR,
  nome_produto VARCHAR,
  unidade_medida VARCHAR,
  categoria VARCHAR,
  total_quantidade DECIMAL,
  total_distribuidoras BIGINT,
  distribuidoras JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    pm.id as produto_master_id,
    pm.sku_master,
    pm.nome as nome_produto,
    pm.unidade_medida,
    pm.categoria,
    COALESCE(SUM(es.quantidade_disponivel * pd.fator_conversao), 0) as total_quantidade,
    COUNT(DISTINCT d.id) as total_distribuidoras,
    jsonb_agg(
      jsonb_build_object(
        'distribuidora_id', d.id,
        'distribuidora_nome', d.nome,
        'quantidade', es.quantidade_disponivel,
        'quantidade_convertida', es.quantidade_disponivel * pd.fator_conversao
      )
    ) FILTER (WHERE d.id IS NOT NULL) as distribuidoras
  FROM public.estoque_produtos_master pm
  LEFT JOIN public.estoque_produtos_distribuidora pd ON pd.produto_master_id = pm.id AND pd.ativo = true
  LEFT JOIN public.estoque_saldos es ON es.produto_distribuidora_id = pd.id
  LEFT JOIN public.estoque_distribuidoras d ON d.id = pd.distribuidora_id AND d.ativo = true
  WHERE pm.ativo = true
  GROUP BY pm.id, pm.sku_master, pm.nome, pm.unidade_medida, pm.categoria;
$$;

-- Função para buscar saldo por código da distribuidora
CREATE OR REPLACE FUNCTION public.get_estoque_por_codigo_distribuidora(
  p_distribuidora_id UUID,
  p_codigo VARCHAR
)
RETURNS TABLE (
  estoque_id UUID,
  produto_master_id UUID,
  sku_master VARCHAR,
  nome_produto VARCHAR,
  codigo_distribuidora VARCHAR,
  quantidade_disponivel DECIMAL,
  quantidade_reservada DECIMAL,
  localizacao VARCHAR,
  lote VARCHAR,
  data_validade DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    es.id as estoque_id,
    pm.id as produto_master_id,
    pm.sku_master,
    pm.nome as nome_produto,
    pd.codigo_produto_distribuidora as codigo_distribuidora,
    es.quantidade_disponivel,
    es.quantidade_reservada,
    es.localizacao,
    es.lote,
    es.data_validade
  FROM public.estoque_saldos es
  JOIN public.estoque_produtos_distribuidora pd ON pd.id = es.produto_distribuidora_id
  JOIN public.estoque_produtos_master pm ON pm.id = pd.produto_master_id
  WHERE pd.distribuidora_id = p_distribuidora_id
    AND pd.codigo_produto_distribuidora = p_codigo
    AND pd.ativo = true;
$$;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para validar alteração direta no saldo
CREATE TRIGGER trg_validar_alteracao_saldo
  BEFORE UPDATE ON public.estoque_saldos
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_alteracao_saldo();

-- Trigger para validar estoque negativo
CREATE TRIGGER trg_validar_estoque_negativo
  BEFORE INSERT ON public.estoque_movimentacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_estoque_negativo();

-- Trigger para atualizar saldo após movimentação
CREATE TRIGGER trg_atualizar_saldo
  AFTER INSERT ON public.estoque_movimentacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_saldo_apos_movimentacao();

-- Triggers de updated_at
CREATE TRIGGER trg_estoque_distribuidoras_updated
  BEFORE UPDATE ON public.estoque_distribuidoras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_estoque_produtos_master_updated
  BEFORE UPDATE ON public.estoque_produtos_master
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_estoque_produtos_distribuidora_updated
  BEFORE UPDATE ON public.estoque_produtos_distribuidora
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.estoque_distribuidoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_produtos_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_produtos_distribuidora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_saldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_sync_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para estoque_distribuidoras
CREATE POLICY "Usuários com acesso ao módulo podem ver distribuidoras"
  ON public.estoque_distribuidoras FOR SELECT
  TO authenticated
  USING (public.usuario_tem_acesso_estoque(auth.uid()));

CREATE POLICY "Admin/Supervisor podem gerenciar distribuidoras"
  ON public.estoque_distribuidoras FOR ALL
  TO authenticated
  USING (public.is_admin_or_supervisor(auth.uid()))
  WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

-- Políticas para estoque_produtos_master
CREATE POLICY "Usuários com acesso ao módulo podem ver produtos master"
  ON public.estoque_produtos_master FOR SELECT
  TO authenticated
  USING (public.usuario_tem_acesso_estoque(auth.uid()));

CREATE POLICY "Admin/Supervisor podem gerenciar produtos master"
  ON public.estoque_produtos_master FOR ALL
  TO authenticated
  USING (public.is_admin_or_supervisor(auth.uid()))
  WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

-- Políticas para estoque_produtos_distribuidora
CREATE POLICY "Usuários com acesso ao módulo podem ver vinculações"
  ON public.estoque_produtos_distribuidora FOR SELECT
  TO authenticated
  USING (public.usuario_tem_acesso_estoque(auth.uid()));

CREATE POLICY "Admin/Supervisor podem gerenciar vinculações"
  ON public.estoque_produtos_distribuidora FOR ALL
  TO authenticated
  USING (public.is_admin_or_supervisor(auth.uid()))
  WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

-- Políticas para estoque_saldos
CREATE POLICY "Usuários com acesso ao módulo podem ver saldos"
  ON public.estoque_saldos FOR SELECT
  TO authenticated
  USING (public.usuario_tem_acesso_estoque(auth.uid()));

CREATE POLICY "Admin/Supervisor podem inserir saldos iniciais"
  ON public.estoque_saldos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

-- UPDATE em saldos é controlado pelo trigger (não permite direto)

-- Políticas para estoque_movimentacoes
CREATE POLICY "Usuários com acesso ao módulo podem ver movimentações"
  ON public.estoque_movimentacoes FOR SELECT
  TO authenticated
  USING (public.usuario_tem_acesso_estoque(auth.uid()));

CREATE POLICY "Usuários com acesso podem registrar movimentações"
  ON public.estoque_movimentacoes FOR INSERT
  TO authenticated
  WITH CHECK (public.usuario_tem_acesso_estoque(auth.uid()));

-- Políticas para estoque_sync_logs (apenas admin)
CREATE POLICY "Apenas admin pode ver logs de sync"
  ON public.estoque_sync_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role pode inserir logs"
  ON public.estoque_sync_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================
-- REGISTRO DO MÓDULO E TELAS
-- =============================================

-- Inserir módulo de estoque
INSERT INTO public.modulos_sistema (codigo, nome, descricao, icone, ordem, ativo)
VALUES ('estoque', 'Gestão de Estoque', 'Controle de estoque multidistribuidoras com integração N8N', 'Warehouse', 7, true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  ordem = EXCLUDED.ordem;

-- Inserir telas do módulo
INSERT INTO public.telas_sistema (codigo, nome, rota, descricao, icone, ordem, ativo)
VALUES 
  ('estoque_dashboard', 'Dashboard Estoque', '/dashboard/estoque', 'Painel principal do módulo de estoque', 'LayoutDashboard', 1, true),
  ('estoque_distribuidoras', 'Distribuidoras', '/dashboard/estoque/distribuidoras', 'Cadastro de distribuidoras', 'Building2', 2, true),
  ('estoque_produtos_master', 'Produtos Master', '/dashboard/estoque/produtos-master', 'Cadastro de produtos master', 'Package', 3, true),
  ('estoque_vinculacoes', 'Vinculações', '/dashboard/estoque/vinculacoes', 'Vinculação de produtos com distribuidoras', 'Link', 4, true),
  ('estoque_saldos', 'Saldos e Movimentações', '/dashboard/estoque/saldos', 'Controle de saldos e movimentações', 'Archive', 5, true),
  ('estoque_consolidado', 'Visão Consolidada', '/dashboard/estoque/consolidado', 'Visão consolidada por produto master', 'BarChart3', 6, true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  rota = EXCLUDED.rota,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  ordem = EXCLUDED.ordem;

-- Permissões por role para o módulo
INSERT INTO public.role_permissoes_modulos (role, modulo_id)
SELECT 'admin', id FROM public.modulos_sistema WHERE codigo = 'estoque'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissoes_modulos (role, modulo_id)
SELECT 'supervisor', id FROM public.modulos_sistema WHERE codigo = 'estoque'
ON CONFLICT DO NOTHING;

-- Permissões por role para as telas
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'admin', id FROM public.telas_sistema WHERE codigo LIKE 'estoque_%'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'supervisor', id FROM public.telas_sistema WHERE codigo LIKE 'estoque_%'
ON CONFLICT DO NOTHING;