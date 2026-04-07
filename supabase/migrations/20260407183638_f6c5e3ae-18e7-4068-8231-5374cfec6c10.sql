
-- 1. Agency Clients
CREATE TABLE public.agency_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  logo_url TEXT,
  segmento TEXT,
  budget_mensal NUMERIC(12,2),
  contrato_inicio DATE,
  contrato_fim DATE,
  responsavel_id UUID,
  status TEXT NOT NULL DEFAULT 'ativo',
  notas TEXT,
  cor TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agency_clients" ON public.agency_clients
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Brand Strategies
CREATE TABLE public.brand_strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agency_client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- persona, swot, voice, positioning
  titulo TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brand_strategies" ON public.brand_strategies
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Content Funnel Items
CREATE TABLE public.content_funnel_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agency_client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  etapa_funil TEXT NOT NULL DEFAULT 'awareness', -- awareness, consideration, decision, retention
  formato TEXT NOT NULL DEFAULT 'post', -- post, reel, story, blog, email, video
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho, em_aprovacao, aprovado, publicado
  data_prevista DATE,
  published_at TIMESTAMPTZ,
  plataforma TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_funnel_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own content_funnel_items" ON public.content_funnel_items
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Competitor Profiles
CREATE TABLE public.competitor_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agency_client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  plataforma TEXT,
  username TEXT,
  followers INTEGER,
  engagement_rate NUMERIC(5,2),
  frequencia_posts TEXT,
  tom_comunicacao TEXT,
  ai_analysis JSONB,
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own competitor_profiles" ON public.competitor_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Campaign Briefings
CREATE TABLE public.campaign_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agency_client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  objetivo TEXT,
  publico TEXT,
  canais TEXT[],
  budget NUMERIC(12,2),
  prazo DATE,
  referencias TEXT,
  conteudo_gerado TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho, finalizado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own campaign_briefings" ON public.campaign_briefings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Client Reports
CREATE TABLE public.client_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agency_client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  metricas JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho, finalizado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own client_reports" ON public.client_reports
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_agency_clients_user ON public.agency_clients(user_id);
CREATE INDEX idx_brand_strategies_client ON public.brand_strategies(agency_client_id);
CREATE INDEX idx_content_funnel_client ON public.content_funnel_items(agency_client_id);
CREATE INDEX idx_content_funnel_date ON public.content_funnel_items(data_prevista);
CREATE INDEX idx_competitor_profiles_client ON public.competitor_profiles(agency_client_id);
CREATE INDEX idx_campaign_briefings_client ON public.campaign_briefings(agency_client_id);
CREATE INDEX idx_client_reports_client ON public.client_reports(agency_client_id);
