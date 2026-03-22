
-- Inscrições de webhooks do ERP
CREATE TABLE public.webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  url text NOT NULL,
  secret text NOT NULL,
  eventos text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  descricao text,
  headers_customizados jsonb DEFAULT '{}',
  max_retries integer DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fila de eventos para dispatch
CREATE TABLE public.webhook_event_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  evento text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tentativas integer DEFAULT 0,
  max_tentativas integer DEFAULT 3,
  proxima_tentativa timestamptz DEFAULT now(),
  ultimo_erro text,
  http_status integer,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Log de entregas
CREATE TABLE public.webhook_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES webhook_event_queue(id),
  subscription_id uuid REFERENCES webhook_subscriptions(id),
  http_status integer,
  response_body text,
  duration_ms integer,
  erro text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_event_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_ws" ON webhook_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_wq" ON webhook_event_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_wl" ON webhook_delivery_log FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_webhook_queue_pending ON webhook_event_queue(status, proxima_tentativa) WHERE status IN ('pending','failed');
CREATE INDEX idx_webhook_queue_sub ON webhook_event_queue(subscription_id);
CREATE INDEX idx_webhook_subs_empresa ON webhook_subscriptions(empresa_id) WHERE ativo = true;

-- Função helper para enfileirar eventos
CREATE OR REPLACE FUNCTION public.enqueue_webhook_event(
  p_evento text,
  p_payload jsonb,
  p_empresa_id integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_count integer := 0;
BEGIN
  FOR v_sub IN
    SELECT id, max_retries FROM webhook_subscriptions
    WHERE ativo = true
      AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
      AND p_evento = ANY(eventos)
  LOOP
    INSERT INTO webhook_event_queue (subscription_id, evento, payload, max_tentativas)
    VALUES (v_sub.id, p_evento, p_payload, v_sub.max_retries);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
