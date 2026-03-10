
-- Tabela de embarques (shipping) vinculada à OC
CREATE TABLE public.china_embarques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id UUID NOT NULL REFERENCES public.china_ordens_compra(id) ON DELETE CASCADE,
  numero_container TEXT,
  numero_bl TEXT,
  booking_number TEXT,
  navio TEXT,
  porto_origem TEXT,
  porto_destino TEXT,
  data_embarque DATE,
  data_eta DATE,
  peso_total_kg NUMERIC(12,2),
  volume_cbm NUMERIC(10,3),
  qtd_volumes INTEGER,
  valor_frete_usd NUMERIC(12,2),
  modalidade TEXT DEFAULT 'FCL',
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.china_embarques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view embarques"
  ON public.china_embarques FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert embarques"
  ON public.china_embarques FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update embarques"
  ON public.china_embarques FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Tabela para fotos/documentos do embarque
CREATE TABLE public.china_embarque_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id UUID NOT NULL REFERENCES public.china_embarques(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'foto',
  nome_arquivo TEXT,
  arquivo_path TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.china_embarque_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage embarque docs"
  ON public.china_embarque_documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Realtime para embarques
ALTER PUBLICATION supabase_realtime ADD TABLE public.china_embarques;
