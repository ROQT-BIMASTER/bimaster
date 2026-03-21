
-- Create updated_at helper function if not exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tabela documento_anexos
CREATE TABLE public.documento_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id TEXT NOT NULL,
  c_cod_int_anexo VARCHAR(20),
  c_tabela VARCHAR(100) NOT NULL,
  n_id BIGINT NOT NULL,
  n_id_anexo BIGINT,
  c_nome_arquivo VARCHAR(100),
  c_tipo_arquivo VARCHAR(10),
  c_md5 VARCHAR(32),
  storage_path TEXT,
  file_size BIGINT,
  importado_api BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_anexos_empresa_tabela_id ON public.documento_anexos(empresa_id, c_tabela, n_id);
CREATE UNIQUE INDEX idx_anexos_empresa_cod_int ON public.documento_anexos(empresa_id, c_cod_int_anexo) WHERE c_cod_int_anexo IS NOT NULL;

ALTER TABLE public.documento_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on documento_anexos"
  ON public.documento_anexos FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage own empresa anexos"
  ON public.documento_anexos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_documento_anexos_updated_at
  BEFORE UPDATE ON public.documento_anexos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('documento-anexos', 'documento-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload anexos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documento-anexos');

CREATE POLICY "Authenticated users can read anexos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documento-anexos');

CREATE POLICY "Authenticated users can delete anexos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documento-anexos');

CREATE POLICY "Service role full access on anexos storage"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'documento-anexos')
  WITH CHECK (bucket_id = 'documento-anexos');
