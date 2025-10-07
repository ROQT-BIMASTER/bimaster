-- Add new fields to prospects table for comprehensive company data
ALTER TABLE public.prospects
ADD COLUMN IF NOT EXISTS cnpj_raiz TEXT,
ADD COLUMN IF NOT EXISTS dominio TEXT,
ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
ADD COLUMN IF NOT EXISTS perfil_linkedin TEXT,
ADD COLUMN IF NOT EXISTS segmento TEXT,
ADD COLUMN IF NOT EXISTS cnae_codigo TEXT,
ADD COLUMN IF NOT EXISTS cnae_principal TEXT,
ADD COLUMN IF NOT EXISTS tipo_estabelecimento TEXT,
ADD COLUMN IF NOT EXISTS total_funcionarios INTEGER,
ADD COLUMN IF NOT EXISTS faixa_funcionarios TEXT,
ADD COLUMN IF NOT EXISTS faixa_faturamento TEXT,
ADD COLUMN IF NOT EXISTS total_filiais INTEGER,
ADD COLUMN IF NOT EXISTS tipo_entidade TEXT,
ADD COLUMN IF NOT EXISTS natureza_juridica TEXT,
ADD COLUMN IF NOT EXISTS data_abertura DATE,
ADD COLUMN IF NOT EXISTS nivel_atividade TEXT,
ADD COLUMN IF NOT EXISTS tendencia_crescimento TEXT,
ADD COLUMN IF NOT EXISTS demais_telefones TEXT,
ADD COLUMN IF NOT EXISTS tipo_logradouro TEXT,
ADD COLUMN IF NOT EXISTS logradouro TEXT,
ADD COLUMN IF NOT EXISTS numero TEXT,
ADD COLUMN IF NOT EXISTS cep TEXT,
ADD COLUMN IF NOT EXISTS bairro TEXT,
ADD COLUMN IF NOT EXISTS demais_emails TEXT,
ADD COLUMN IF NOT EXISTS perfil_facebook TEXT,
ADD COLUMN IF NOT EXISTS perfil_instagram TEXT,
ADD COLUMN IF NOT EXISTS perfil_twitter TEXT,
ADD COLUMN IF NOT EXISTS url_company_page TEXT,
ADD COLUMN IF NOT EXISTS situacao TEXT,
ADD COLUMN IF NOT EXISTS territorio TEXT,
ADD COLUMN IF NOT EXISTS trm TEXT,
ADD COLUMN IF NOT EXISTS faixa_score_propensao TEXT,
ADD COLUMN IF NOT EXISTS score_propensao NUMERIC,
ADD COLUMN IF NOT EXISTS faixa_score_contactability TEXT,
ADD COLUMN IF NOT EXISTS variacao_score_propensao NUMERIC;

-- Add indexes for commonly searched fields
CREATE INDEX IF NOT EXISTS idx_prospects_cnpj_raiz ON public.prospects(cnpj_raiz);
CREATE INDEX IF NOT EXISTS idx_prospects_segmento ON public.prospects(segmento);
CREATE INDEX IF NOT EXISTS idx_prospects_cep ON public.prospects(cep);
CREATE INDEX IF NOT EXISTS idx_prospects_situacao ON public.prospects(situacao);