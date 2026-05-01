
-- =============================================================
-- Tracking de Containers via ShipsGo (Ocean)
-- =============================================================

-- Tabela principal de shipments
CREATE TABLE public.shipsgo_shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Vínculos internos
  embarque_id UUID REFERENCES public.china_embarques(id) ON DELETE SET NULL,
  ordem_compra_id UUID REFERENCES public.china_ordens_compra(id) ON DELETE SET NULL,

  -- Identificadores ShipsGo / armador
  shipsgo_id TEXT UNIQUE,
  container_number TEXT,
  bl_number TEXT,
  booking_number TEXT,
  carrier_code TEXT,
  carrier_name TEXT,

  -- Status normalizado
  status TEXT NOT NULL DEFAULT 'PENDING',
  -- valores típicos: PENDING, BOOKING_CONFIRMED, GATE_IN, LOADED, EN_ROUTE,
  -- TRANSSHIPMENT, DISCHARGED, GATE_OUT, DELIVERED, UNKNOWN

  -- Portos / rota
  pol_name TEXT,
  pol_country TEXT,
  pol_unlocode TEXT,
  pod_name TEXT,
  pod_country TEXT,
  pod_unlocode TEXT,

  -- Datas
  eta_original DATE,
  eta_atual DATE,
  ata DATE,
  data_embarque DATE,

  -- Atraso em dias (gerado a partir de eta_original/eta_atual)
  dias_atraso INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN eta_original IS NOT NULL AND eta_atual IS NOT NULL
        THEN (eta_atual - eta_original)
      ELSE NULL
    END
  ) STORED,

  -- Último evento conhecido
  last_event_at TIMESTAMPTZ,
  last_event_description TEXT,
  last_event_location TEXT,

  -- Rota geográfica (geojson da ShipsGo)
  geojson JSONB,

  -- Payload bruto da ShipsGo para auditoria
  raw_payload JSONB,

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipsgo_shipments_embarque ON public.shipsgo_shipments(embarque_id);
CREATE INDEX idx_shipsgo_shipments_oc ON public.shipsgo_shipments(ordem_compra_id);
CREATE INDEX idx_shipsgo_shipments_container ON public.shipsgo_shipments(container_number);
CREATE INDEX idx_shipsgo_shipments_bl ON public.shipsgo_shipments(bl_number);
CREATE INDEX idx_shipsgo_shipments_status ON public.shipsgo_shipments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipsgo_shipments_eta ON public.shipsgo_shipments(eta_atual) WHERE deleted_at IS NULL;

-- Eventos do shipment (timeline)
CREATE TABLE public.shipsgo_shipment_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES public.shipsgo_shipments(id) ON DELETE CASCADE,
  event_type TEXT,
  event_code TEXT,
  description TEXT,
  location_name TEXT,
  location_unlocode TEXT,
  vessel_name TEXT,
  voyage_number TEXT,
  event_at TIMESTAMPTZ NOT NULL,
  is_actual BOOLEAN NOT NULL DEFAULT true, -- false = estimado
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, event_code, event_at, location_unlocode)
);

CREATE INDEX idx_shipsgo_events_shipment ON public.shipsgo_shipment_events(shipment_id, event_at DESC);

-- Log de webhooks (idempotência)
CREATE TABLE public.shipsgo_webhook_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipsgo_id TEXT,
  event_type TEXT,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipsgo_webhook_received ON public.shipsgo_webhook_log(received_at DESC);
CREATE INDEX idx_shipsgo_webhook_shipsgo_id ON public.shipsgo_webhook_log(shipsgo_id);

-- Trigger updated_at
CREATE TRIGGER trg_shipsgo_shipments_updated_at
  BEFORE UPDATE ON public.shipsgo_shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE public.shipsgo_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipsgo_shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipsgo_webhook_log ENABLE ROW LEVEL SECURITY;

-- shipsgo_shipments: leitura para quem enxerga a OC vinculada OU admin
CREATE POLICY "shipsgo_shipments_select_via_oc"
ON public.shipsgo_shipments
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR ordem_compra_id IN (
      SELECT id FROM public.china_ordens_compra
    )
    -- A leitura de china_ordens_compra já é filtrada pelas RLS dela,
    -- então o IN só retorna OCs visíveis ao usuário.
  )
);

-- Inserts/updates/deletes só via service role (edge functions)
-- Sem políticas para INSERT/UPDATE/DELETE = bloqueado para authenticated.

-- shipsgo_shipment_events: leitura via shipment visível
CREATE POLICY "shipsgo_events_select_via_shipment"
ON public.shipsgo_shipment_events
FOR SELECT
TO authenticated
USING (
  shipment_id IN (
    SELECT id FROM public.shipsgo_shipments
  )
);

-- shipsgo_webhook_log: somente admin pode consultar
CREATE POLICY "shipsgo_webhook_log_admin_select"
ON public.shipsgo_webhook_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
