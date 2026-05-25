
-- Tabela de contratos do fornecedor
CREATE TABLE IF NOT EXISTS public.fornecedor_contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_codigo TEXT NOT NULL,
  fornecedor_nome TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('ativo','cancelamento')),
  data_vigencia_inicio DATE,
  data_vigencia_fim DATE,
  numero_contrato TEXT,
  valor_mensal NUMERIC(14,2),
  valor_total NUMERIC(14,2),
  observacoes TEXT,
  arquivo_path TEXT,
  arquivo_nome TEXT,
  arquivo_mime TEXT,
  arquivo_tamanho INTEGER,
  resumo_ia TEXT,
  analise_ia_json JSONB,
  analise_ia_em TIMESTAMPTZ,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_contratos_codigo
  ON public.fornecedor_contratos(fornecedor_codigo);
CREATE INDEX IF NOT EXISTS idx_fornecedor_contratos_tipo
  ON public.fornecedor_contratos(fornecedor_codigo, tipo);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fornecedor_contrato_ativo
  ON public.fornecedor_contratos(fornecedor_codigo) WHERE tipo = 'ativo';

-- Trigger de validação (sem CHECK imutável)
CREATE OR REPLACE FUNCTION public.fornecedor_contratos_validate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tipo = 'ativo' AND NEW.data_vigencia_inicio IS NULL THEN
    RAISE EXCEPTION 'Contrato ativo requer data de vigência inicial';
  END IF;
  IF NEW.tipo = 'cancelamento' AND NEW.data_vigencia_fim IS NULL THEN
    RAISE EXCEPTION 'Contrato de cancelamento requer data de término';
  END IF;
  IF NEW.data_vigencia_inicio IS NOT NULL
     AND NEW.data_vigencia_fim IS NOT NULL
     AND NEW.data_vigencia_fim < NEW.data_vigencia_inicio THEN
    RAISE EXCEPTION 'Data de término não pode ser anterior à data inicial';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fornecedor_contratos_validate ON public.fornecedor_contratos;
CREATE TRIGGER trg_fornecedor_contratos_validate
  BEFORE INSERT OR UPDATE ON public.fornecedor_contratos
  FOR EACH ROW EXECUTE FUNCTION public.fornecedor_contratos_validate();

-- RLS
ALTER TABLE public.fornecedor_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem visualizar contratos"
  ON public.fornecedor_contratos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins e supervisores podem inserir contratos"
  ON public.fornecedor_contratos FOR INSERT
  TO authenticated WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores podem atualizar contratos"
  ON public.fornecedor_contratos FOR UPDATE
  TO authenticated USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins podem remover contratos"
  ON public.fornecedor_contratos FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Bucket privado para arquivos dos contratos
INSERT INTO storage.buckets (id, name, public)
VALUES ('fornecedor-contratos', 'fornecedor-contratos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Autenticados leem contratos do bucket"
  ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'fornecedor-contratos');

CREATE POLICY "Admins e supervisores gravam contratos no bucket"
  ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'fornecedor-contratos'
    AND public.is_admin_or_supervisor(auth.uid())
  );

CREATE POLICY "Admins e supervisores atualizam contratos no bucket"
  ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'fornecedor-contratos'
    AND public.is_admin_or_supervisor(auth.uid())
  );

CREATE POLICY "Admins removem contratos do bucket"
  ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'fornecedor-contratos'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
