
-- ============================================================
-- FASE 1: Campos de padrão de mercado ERP
-- ============================================================

-- 1. EMPRESAS — campos fiscais e cadastrais
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS codigo_erp varchar(60),
  ADD COLUMN IF NOT EXISTS regime_apuracao varchar(20) DEFAULT 'Competência',
  ADD COLUMN IF NOT EXISTS tipo_empresa varchar(20) DEFAULT 'Matriz',
  ADD COLUMN IF NOT EXISTS natureza_juridica varchar(40),
  ADD COLUMN IF NOT EXISTS porte varchar(20),
  ADD COLUMN IF NOT EXISTS capital_social numeric(15,2),
  ADD COLUMN IF NOT EXISTS data_abertura date,
  ADD COLUMN IF NOT EXISTS codigo_ibge_municipio integer,
  ADD COLUMN IF NOT EXISTS responsavel_nome varchar(120),
  ADD COLUMN IF NOT EXISTS responsavel_cpf varchar(14);

CREATE INDEX IF NOT EXISTS idx_empresas_codigo_erp ON public.empresas (codigo_erp);

-- 2. CLIENTES — campos fiscais
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS contribuinte varchar(10) DEFAULT 'S',
  ADD COLUMN IF NOT EXISTS pessoa_fisica varchar(1) DEFAULT 'N',
  ADD COLUMN IF NOT EXISTS codigo_ibge_municipio integer,
  ADD COLUMN IF NOT EXISTS endereco_numero varchar(20),
  ADD COLUMN IF NOT EXISTS complemento varchar(120);

-- 3. DEPARTAMENTOS — multi-empresa e integração
ALTER TABLE public.departamentos
  ADD COLUMN IF NOT EXISTS empresa_id integer REFERENCES public.empresas(id),
  ADD COLUMN IF NOT EXISTS codigo_integracao varchar(60);

CREATE INDEX IF NOT EXISTS idx_departamentos_empresa_id ON public.departamentos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_departamentos_codigo_integracao ON public.departamentos (codigo_integracao);

-- 4. PLANO DE CONTAS — categorização
ALTER TABLE public.plano_contas
  ADD COLUMN IF NOT EXISTS tipo_categoria varchar(1),
  ADD COLUMN IF NOT EXISTS conta_dre_id uuid REFERENCES public.plano_contas(id),
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS natureza varchar(200);

-- 5. CONTAS A PAGAR — centro de custo
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_centro_custo ON public.contas_pagar (centro_custo_id);
