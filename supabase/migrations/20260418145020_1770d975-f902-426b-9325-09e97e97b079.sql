-- PR-14 / Onda 3: schema dos endpoints avançados de Contas a Pagar.
-- 1) UNIQUE em parcelas para upsert idempotente por (conta_pagar_id, numero_parcela).
-- 2) Tabela cp_anexos (handler atual aponta para payment_attachments inexistente).

ALTER TABLE public.parcelas
  ADD CONSTRAINT parcelas_conta_numero_uniq UNIQUE (conta_pagar_id, numero_parcela);

CREATE TABLE public.cp_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_pagar_id uuid NOT NULL REFERENCES public.contas_pagar(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  tipo text,
  url text,
  observacao text,
  source text DEFAULT 'api',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX cp_anexos_conta_pagar_id_idx ON public.cp_anexos(conta_pagar_id);

ALTER TABLE public.cp_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cp_anexos_admin_full"
  ON public.cp_anexos
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "cp_anexos_service_role"
  ON public.cp_anexos
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');