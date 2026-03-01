
-- Dimensão de vendedores do ERP (mapeamento vendedor↔cliente)
CREATE TABLE public.dimensao_vendedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_vnd INTEGER NOT NULL,
  nomemapa_vnd TEXT NOT NULL,
  equipe_vnd INTEGER,
  nome_eqp TEXT,
  cnpj_par TEXT,
  cliente_clivend TEXT NOT NULL,
  row_num TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(id_vnd, cliente_clivend)
);

-- Índices para buscas frequentes
CREATE INDEX idx_dimensao_vendedores_cliente ON public.dimensao_vendedores(cliente_clivend);
CREATE INDEX idx_dimensao_vendedores_id_vnd ON public.dimensao_vendedores(id_vnd);
CREATE INDEX idx_dimensao_vendedores_cnpj ON public.dimensao_vendedores(cnpj_par);

-- RLS
ALTER TABLE public.dimensao_vendedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dimensao_vendedores"
ON public.dimensao_vendedores FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage dimensao_vendedores"
ON public.dimensao_vendedores FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger updated_at
CREATE TRIGGER update_dimensao_vendedores_updated_at
BEFORE UPDATE ON public.dimensao_vendedores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
