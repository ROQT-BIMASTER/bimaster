
-- Tabela de controle de exportação para o ERP
CREATE TABLE public.erp_export_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_queue_id uuid NOT NULL REFERENCES public.financial_payment_queue(id) ON DELETE CASCADE,
  export_channel text NOT NULL DEFAULT 'n8n' CHECK (export_channel IN ('n8n', 'sql_direct', 'rest_api')),
  export_status text NOT NULL DEFAULT 'pending' CHECK (export_status IN ('pending', 'sent', 'success', 'error')),
  payload jsonb DEFAULT '{}'::jsonb,
  response jsonb,
  attempts int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  error_message text,
  exported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.erp_export_queue ENABLE ROW LEVEL SECURITY;

-- RLS: financeiro/admin podem ver e gerenciar
CREATE POLICY "erp_export_select" ON public.erp_export_queue
  FOR SELECT TO authenticated
  USING (
    public.can_access_payment_queue(auth.uid())
  );

CREATE POLICY "erp_export_insert" ON public.erp_export_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_payment_queue(auth.uid())
  );

CREATE POLICY "erp_export_update" ON public.erp_export_queue
  FOR UPDATE TO authenticated
  USING (
    public.can_access_payment_queue(auth.uid())
  );
