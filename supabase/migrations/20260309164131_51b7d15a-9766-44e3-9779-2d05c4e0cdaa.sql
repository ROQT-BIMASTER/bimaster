
CREATE TABLE public.financial_payment_queue_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_queue_id uuid REFERENCES public.financial_payment_queue(id) ON DELETE CASCADE NOT NULL,
  changed_by uuid,
  changed_by_name text,
  changed_at timestamptz DEFAULT now(),
  action text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  changes jsonb
);

ALTER TABLE public.financial_payment_queue_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view history" ON public.financial_payment_queue_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert history" ON public.financial_payment_queue_history FOR INSERT TO authenticated WITH CHECK (true);
