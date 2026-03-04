
-- Tabela de mensagens de comunicação inline entre solicitantes e financeiro
CREATE TABLE public.financial_payment_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_queue_id uuid NOT NULL REFERENCES public.financial_payment_queue(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES auth.users(id),
  usuario_nome text NOT NULL,
  conteudo text NOT NULL,
  tipo text NOT NULL DEFAULT 'solicitante',
  anexos jsonb DEFAULT '[]'::jsonb,
  lida_por uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.financial_payment_messages ENABLE ROW LEVEL SECURITY;

-- Solicitantes veem mensagens dos seus itens, financeiro vê tudo
CREATE POLICY "fpm_select_policy" ON public.financial_payment_messages
FOR SELECT TO authenticated
USING (
  usuario_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.financial_payment_queue q 
    WHERE q.id = payment_queue_id AND q.requested_by = auth.uid()
  )
  OR public.can_access_payment_queue(auth.uid())
);

CREATE POLICY "fpm_insert_policy" ON public.financial_payment_messages
FOR INSERT TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.financial_payment_queue q 
      WHERE q.id = payment_queue_id AND q.requested_by = auth.uid()
    )
    OR public.can_access_payment_queue(auth.uid())
  )
);

CREATE POLICY "fpm_update_policy" ON public.financial_payment_messages
FOR UPDATE TO authenticated
USING (
  public.can_access_payment_queue(auth.uid())
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_payment_messages;

-- Index for performance
CREATE INDEX idx_fpm_payment_queue_id ON public.financial_payment_messages(payment_queue_id);
CREATE INDEX idx_fpm_created_at ON public.financial_payment_messages(created_at);
