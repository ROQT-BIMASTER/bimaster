-- =====================================================
-- SISTEMA DE PRECIFICAÇÃO EM CASCATA
-- =====================================================

-- Tabela de Tabelas de Preço (configuração das tabelas)
CREATE TABLE fabrica_tabelas_preco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(50) UNIQUE NOT NULL,
  nome varchar(200) NOT NULL,
  descricao text,
  tipo_base varchar(50) NOT NULL DEFAULT 'custo_producao',
  tabela_base_id uuid REFERENCES fabrica_tabelas_preco(id) ON DELETE SET NULL,
  tipo_markup varchar(50) NOT NULL DEFAULT 'percentual',
  valor_markup numeric(10,4) NOT NULL DEFAULT 0,
  ordem integer DEFAULT 1,
  ativo boolean DEFAULT true,
  data_vigencia_inicio date,
  data_vigencia_fim date,
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT tipo_base_valido CHECK (tipo_base IN ('custo_producao', 'tabela_anterior', 'manual')),
  CONSTRAINT tipo_markup_valido CHECK (tipo_markup IN ('percentual', 'multiplicador', 'valor_fixo')),
  CONSTRAINT valor_markup_positivo CHECK (valor_markup >= 0)
);

-- Tabela de Preços por Produto
CREATE TABLE fabrica_precos_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_id uuid NOT NULL REFERENCES fabrica_tabelas_preco(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES fabrica_materias_primas(id) ON DELETE CASCADE,
  custo_base numeric(15,4),
  custo_base_origem varchar(50) DEFAULT 'manual',
  ordem_producao_id uuid REFERENCES fabrica_ordens_producao(id),
  preco_calculado numeric(15,4),
  preco_manual numeric(15,4),
  preco_final numeric(15,4),
  margem_lucro_percentual numeric(5,2),
  ativo boolean DEFAULT true,
  data_atualizacao timestamp with time zone DEFAULT now(),
  atualizado_por uuid REFERENCES auth.users(id),
  
  UNIQUE(tabela_id, produto_id),
  CONSTRAINT custo_base_origem_valido CHECK (custo_base_origem IN ('ordem_producao', 'manual', 'tabela_anterior'))
);

-- Tabela de Histórico de Preços
CREATE TABLE fabrica_historico_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES fabrica_materias_primas(id) ON DELETE CASCADE,
  tabela_id uuid NOT NULL REFERENCES fabrica_tabelas_preco(id) ON DELETE CASCADE,
  preco_anterior numeric(15,4),
  preco_novo numeric(15,4),
  motivo_alteracao text,
  data_alteracao timestamp with time zone DEFAULT now(),
  alterado_por uuid REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX idx_tabelas_preco_ativo ON fabrica_tabelas_preco(ativo) WHERE ativo = true;
CREATE INDEX idx_tabelas_preco_ordem ON fabrica_tabelas_preco(ordem);
CREATE INDEX idx_tabelas_preco_base ON fabrica_tabelas_preco(tabela_base_id) WHERE tabela_base_id IS NOT NULL;
CREATE INDEX idx_precos_produtos_tabela ON fabrica_precos_produtos(tabela_id);
CREATE INDEX idx_precos_produtos_produto ON fabrica_precos_produtos(produto_id);
CREATE INDEX idx_historico_precos_produto ON fabrica_historico_precos(produto_id);
CREATE INDEX idx_historico_precos_tabela ON fabrica_historico_precos(tabela_id);
CREATE INDEX idx_historico_precos_data ON fabrica_historico_precos(data_alteracao DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_tabela_preco_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_tabelas_preco_updated_at
  BEFORE UPDATE ON fabrica_tabelas_preco
  FOR EACH ROW
  EXECUTE FUNCTION update_tabela_preco_updated_at();

-- Trigger para registrar histórico de alterações de preço
CREATE OR REPLACE FUNCTION registrar_historico_preco()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.preco_final IS DISTINCT FROM NEW.preco_final) THEN
    INSERT INTO fabrica_historico_precos (
      produto_id,
      tabela_id,
      preco_anterior,
      preco_novo,
      motivo_alteracao,
      alterado_por
    ) VALUES (
      NEW.produto_id,
      NEW.tabela_id,
      OLD.preco_final,
      NEW.preco_final,
      'Atualização de preço',
      NEW.atualizado_por
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_registrar_historico_preco
  AFTER UPDATE ON fabrica_precos_produtos
  FOR EACH ROW
  EXECUTE FUNCTION registrar_historico_preco();

-- RLS Policies para fabrica_tabelas_preco
ALTER TABLE fabrica_tabelas_preco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e supervisores gerenciam tabelas de preço"
  ON fabrica_tabelas_preco
  FOR ALL
  TO authenticated
  USING (is_admin_or_supervisor(auth.uid()))
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários com permissão fabrica veem tabelas de preço"
  ON fabrica_tabelas_preco
  FOR SELECT
  TO authenticated
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- RLS Policies para fabrica_precos_produtos
ALTER TABLE fabrica_precos_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e supervisores gerenciam preços de produtos"
  ON fabrica_precos_produtos
  FOR ALL
  TO authenticated
  USING (is_admin_or_supervisor(auth.uid()))
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários com permissão fabrica veem preços de produtos"
  ON fabrica_precos_produtos
  FOR SELECT
  TO authenticated
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- RLS Policies para fabrica_historico_precos
ALTER TABLE fabrica_historico_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários com permissão fabrica veem histórico de preços"
  ON fabrica_historico_precos
  FOR SELECT
  TO authenticated
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Sistema registra histórico de preços"
  ON fabrica_historico_precos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);