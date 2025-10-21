-- Tabela de auditoria de consultas à API CNPJ.BIZ
CREATE TABLE IF NOT EXISTS public.cnpjbiz_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('contar', 'listar', 'buscar-cnpj', 'atividades', 'naturezas', 'localidades', 'bairros', 'creditos')),
  credits_used INTEGER DEFAULT 0,
  filters JSONB,
  results_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cnpjbiz_audit_user ON public.cnpjbiz_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_cnpjbiz_audit_created ON public.cnpjbiz_audit(created_at DESC);

-- RLS para auditoria
ALTER TABLE public.cnpjbiz_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver própria auditoria"
  ON public.cnpjbiz_audit FOR SELECT
  USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Sistema pode inserir auditoria"
  ON public.cnpjbiz_audit FOR INSERT
  WITH CHECK (true);

-- Tabela de cache para economizar créditos
CREATE TABLE IF NOT EXISTS public.cnpjbiz_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cnpjbiz_cache_key ON public.cnpjbiz_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_cnpjbiz_cache_expires ON public.cnpjbiz_cache(expires_at);

-- RLS para cache (apenas sistema acessa)
ALTER TABLE public.cnpjbiz_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total ao cache"
  ON public.cnpjbiz_cache FOR ALL
  USING (true)
  WITH CHECK (true);

-- Adicionar campos opcionais na tabela prospects
ALTER TABLE public.prospects 
ADD COLUMN IF NOT EXISTS cnae_principal TEXT,
ADD COLUMN IF NOT EXISTS cnae_secundarios TEXT[],
ADD COLUMN IF NOT EXISTS natureza_juridica TEXT,
ADD COLUMN IF NOT EXISTS capital_social DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS data_abertura DATE,
ADD COLUMN IF NOT EXISTS situacao_cadastral TEXT,
ADD COLUMN IF NOT EXISTS socios JSONB;