
-- Tabela: Conexões bancárias via Pluggy
CREATE TABLE public.bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  banco TEXT NOT NULL,
  pluggy_item_id TEXT,
  conta TEXT,
  agencia TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage bank_connections"
ON public.bank_connections FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Tabela: Conciliações bancárias (transações do extrato + match)
CREATE TABLE public.conciliacoes_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE CASCADE NOT NULL,
  data_transacao DATE NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'debito',
  documento TEXT,
  conta_pagar_id UUID,
  status_conciliacao TEXT NOT NULL DEFAULT 'pendente',
  confianca TEXT,
  pluggy_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conciliacoes_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage conciliacoes_bancarias"
ON public.conciliacoes_bancarias FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Tabela: Histórico de sincronizações
CREATE TABLE public.conciliacao_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE CASCADE NOT NULL,
  total_transacoes INT DEFAULT 0,
  conciliados INT DEFAULT 0,
  pendentes INT DEFAULT 0,
  divergentes INT DEFAULT 0,
  duracao_ms INT,
  status TEXT NOT NULL DEFAULT 'processing',
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conciliacao_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage conciliacao_uploads"
ON public.conciliacao_uploads FOR ALL TO authenticated
USING (true) WITH CHECK (true);
