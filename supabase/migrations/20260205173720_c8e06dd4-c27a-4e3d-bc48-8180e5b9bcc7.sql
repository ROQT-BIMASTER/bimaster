-- Tabela de cache para consultas OpenCNPJ (economia de requisições)
CREATE TABLE IF NOT EXISTS public.opencnpj_cache (
  cnpj TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days')
);

-- Habilitar RLS
ALTER TABLE public.opencnpj_cache ENABLE ROW LEVEL SECURITY;

-- Política de leitura para usuários autenticados
CREATE POLICY "Usuários autenticados podem ler cache" 
ON public.opencnpj_cache 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Política de inserção para usuários autenticados
CREATE POLICY "Usuários autenticados podem inserir cache" 
ON public.opencnpj_cache 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Política de update para usuários autenticados
CREATE POLICY "Usuários autenticados podem atualizar cache" 
ON public.opencnpj_cache 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Índice para limpeza de cache expirado
CREATE INDEX idx_opencnpj_cache_expires_at ON public.opencnpj_cache(expires_at);