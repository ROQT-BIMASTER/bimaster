-- Profissionalização do BOM e Controle de Produção
-- Adiciona máquinas, operadores, custos de MOD e controle avançado

-- 1. TABELA DE MÁQUINAS
CREATE TABLE IF NOT EXISTS fabrica_maquinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(100),
  fabricante VARCHAR(200),
  numero_serie VARCHAR(100),
  ano_fabricacao INTEGER,
  capacidade_hora DECIMAL(15,3),
  unidade_capacidade VARCHAR(50),
  custo_hora DECIMAL(15,2),
  centro_custo VARCHAR(100),
  localizacao VARCHAR(200),
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'manutencao', 'inativo')),
  ultima_manutencao DATE,
  proxima_manutencao DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fabrica_maquinas_status ON fabrica_maquinas(status);
CREATE INDEX idx_fabrica_maquinas_tipo ON fabrica_maquinas(tipo);

-- 2. TABELA DE OPERADORES
CREATE TABLE IF NOT EXISTS fabrica_operadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  matricula VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(200) NOT NULL,
  funcao VARCHAR(100),
  custo_hora DECIMAL(15,2),
  centro_custo VARCHAR(100),
  nivel_experiencia VARCHAR(50) CHECK (nivel_experiencia IN ('junior', 'pleno', 'senior', 'especialista')),
  habilidades TEXT[],
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'afastado', 'ferias', 'inativo')),
  data_admissao DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fabrica_operadores_status ON fabrica_operadores(status);
CREATE INDEX idx_fabrica_operadores_user ON fabrica_operadores(user_id);

-- 3. ADICIONAR CAMPOS A ORDENS DE PRODUÇÃO
ALTER TABLE fabrica_ordens_producao
ADD COLUMN IF NOT EXISTS maquina_id UUID REFERENCES fabrica_maquinas(id),
ADD COLUMN IF NOT EXISTS operador_principal_id UUID REFERENCES fabrica_operadores(id),
ADD COLUMN IF NOT EXISTS tempo_setup_minutos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tempo_producao_real_minutos INTEGER,
ADD COLUMN IF NOT EXISTS custo_mod_total DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS custo_maquina_total DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS eficiencia_percentual DECIMAL(5,2);

-- 4. ADICIONAR CAMPOS A APONTAMENTOS
ALTER TABLE fabrica_apontamentos
ADD COLUMN IF NOT EXISTS maquina_id UUID REFERENCES fabrica_maquinas(id),
ADD COLUMN IF NOT EXISTS tempo_setup_minutos INTEGER,
ADD COLUMN IF NOT EXISTS velocidade_producao DECIMAL(15,3),
ADD COLUMN IF NOT EXISTS temperatura DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS pressao DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS parametros_processo JSONB;

-- 5. TABELA DE TIMESHEETS (REGISTRO DE HORAS)
CREATE TABLE IF NOT EXISTS fabrica_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id UUID REFERENCES fabrica_operadores(id) NOT NULL,
  ordem_producao_id UUID REFERENCES fabrica_ordens_producao(id),
  maquina_id UUID REFERENCES fabrica_maquinas(id),
  data_trabalho DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME,
  duracao_minutos INTEGER,
  tipo_atividade VARCHAR(100) CHECK (tipo_atividade IN ('producao', 'setup', 'manutencao', 'treinamento', 'parada')),
  custo_hora_operador DECIMAL(15,2),
  custo_total DECIMAL(15,2),
  observacoes TEXT,
  aprovado BOOLEAN DEFAULT false,
  aprovado_por UUID REFERENCES profiles(id),
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_fabrica_timesheets_operador ON fabrica_timesheets(operador_id);
CREATE INDEX idx_fabrica_timesheets_op ON fabrica_timesheets(ordem_producao_id);
CREATE INDEX idx_fabrica_timesheets_data ON fabrica_timesheets(data_trabalho);

-- 6. TABELA DE ROTEIROS DE PRODUÇÃO
CREATE TABLE IF NOT EXISTS fabrica_roteiros_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID REFERENCES fabrica_formulas(id) NOT NULL,
  sequencia INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  maquina_sugerida_id UUID REFERENCES fabrica_maquinas(id),
  tempo_estimado_minutos INTEGER,
  temperatura_ideal DECIMAL(10,2),
  pressao_ideal DECIMAL(10,2),
  velocidade_ideal DECIMAL(15,3),
  parametros JSONB,
  instrucoes TEXT,
  pontos_criticos TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fabrica_roteiros_formula ON fabrica_roteiros_producao(formula_id);
CREATE INDEX idx_fabrica_roteiros_sequencia ON fabrica_roteiros_producao(formula_id, sequencia);

-- 7. FUNÇÃO PARA CALCULAR CUSTOS DE MOD
CREATE OR REPLACE FUNCTION calcular_custo_mod_op(p_ordem_producao_id UUID)
RETURNS DECIMAL(15,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_custo_total DECIMAL(15,2) := 0;
BEGIN
  SELECT COALESCE(SUM(custo_total), 0)
  INTO v_custo_total
  FROM fabrica_timesheets
  WHERE ordem_producao_id = p_ordem_producao_id
    AND aprovado = true;
  
  RETURN v_custo_total;
END;
$$;

-- 8. TRIGGER PARA CALCULAR DURAÇÃO DE TIMESHEET
CREATE OR REPLACE FUNCTION calcular_duracao_timesheet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.hora_fim IS NOT NULL THEN
    NEW.duracao_minutos := EXTRACT(EPOCH FROM (NEW.hora_fim::time - NEW.hora_inicio::time)) / 60;
    
    IF NEW.custo_hora_operador IS NOT NULL THEN
      NEW.custo_total := (NEW.duracao_minutos / 60.0) * NEW.custo_hora_operador;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_calcular_duracao_timesheet
BEFORE INSERT OR UPDATE ON fabrica_timesheets
FOR EACH ROW
EXECUTE FUNCTION calcular_duracao_timesheet();

-- 9. RLS POLICIES
ALTER TABLE fabrica_maquinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_roteiros_producao ENABLE ROW LEVEL SECURITY;

-- Maquinas: Todos podem ver, apenas admin/supervisor gerenciam
CREATE POLICY "Usuários podem ver máquinas" ON fabrica_maquinas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia máquinas" ON fabrica_maquinas FOR ALL TO authenticated USING (is_admin_or_supervisor(auth.uid()));

-- Operadores: Todos podem ver, apenas admin/supervisor gerenciam
CREATE POLICY "Usuários podem ver operadores" ON fabrica_operadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia operadores" ON fabrica_operadores FOR ALL TO authenticated USING (is_admin_or_supervisor(auth.uid()));

-- Timesheets: Operador cria os seus, supervisor aprova
CREATE POLICY "Operadores criam timesheets" ON fabrica_timesheets FOR INSERT TO authenticated 
WITH CHECK (operador_id IN (SELECT id FROM fabrica_operadores WHERE user_id = auth.uid()));

CREATE POLICY "Operadores veem seus timesheets" ON fabrica_timesheets FOR SELECT TO authenticated 
USING (operador_id IN (SELECT id FROM fabrica_operadores WHERE user_id = auth.uid()) OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Supervisor aprova timesheets" ON fabrica_timesheets FOR UPDATE TO authenticated 
USING (is_admin_or_supervisor(auth.uid()));

-- Roteiros: Todos podem ver, apenas admin gerencia
CREATE POLICY "Usuários podem ver roteiros" ON fabrica_roteiros_producao FOR SELECT TO authenticated USING (ativo = true OR is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admin gerencia roteiros" ON fabrica_roteiros_producao FOR ALL TO authenticated USING (is_admin_or_supervisor(auth.uid()));

COMMENT ON TABLE fabrica_maquinas IS 'Cadastro de máquinas e equipamentos da fábrica';
COMMENT ON TABLE fabrica_operadores IS 'Cadastro de operadores de produção';
COMMENT ON TABLE fabrica_timesheets IS 'Registro de horas trabalhadas por operador';
COMMENT ON TABLE fabrica_roteiros_producao IS 'Roteiro de produção (processo passo a passo) para cada fórmula';