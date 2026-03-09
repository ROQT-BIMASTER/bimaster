
CREATE TABLE public.financial_correction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Regra Padrão',
  is_active boolean NOT NULL DEFAULT true,
  lock_supplier_name boolean NOT NULL DEFAULT true,
  lock_supplier_document boolean NOT NULL DEFAULT true,
  lock_document_type boolean NOT NULL DEFAULT false,
  lock_document_number boolean NOT NULL DEFAULT false,
  lock_due_date boolean NOT NULL DEFAULT false,
  lock_portador boolean NOT NULL DEFAULT false,
  lock_attachments boolean NOT NULL DEFAULT false,
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_correction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read correction rules"
ON public.financial_correction_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage correction rules"
ON public.financial_correction_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default rule
INSERT INTO public.financial_correction_rules (name, description, lock_supplier_name, lock_supplier_document, lock_document_type, lock_document_number, lock_due_date, lock_portador, lock_attachments)
VALUES ('Regra Padrão', 'Ao rejeitar, bloqueia apenas o fornecedor. O solicitante pode ajustar documentos e forma de pagamento.', true, true, false, false, false, false, false);
