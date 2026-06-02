-- 1) briefings: colunas de espelho RR-Tasks
ALTER TABLE public.briefings
  ADD COLUMN IF NOT EXISTS rrtask_page_id          text,
  ADD COLUMN IF NOT EXISTS rrtask_page_url         text,
  ADD COLUMN IF NOT EXISTS rrtask_synced_at        timestamptz,
  ADD COLUMN IF NOT EXISTS rrtask_round            smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rrtask_aprovacao        text,
  ADD COLUMN IF NOT EXISTS rrtask_status           text,
  ADD COLUMN IF NOT EXISTS rrtask_etapa            text,
  ADD COLUMN IF NOT EXISTS rrtask_data_aprovacao   date,
  ADD COLUMN IF NOT EXISTS rrtask_last_edited_time timestamptz,
  ADD COLUMN IF NOT EXISTS rrtask_last_polled_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_briefings_rrtask_page
  ON public.briefings(rrtask_page_id) WHERE rrtask_page_id IS NOT NULL;

-- 2) rr_solicitante_map
CREATE TABLE IF NOT EXISTS public.rr_solicitante_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  notion_user_id text,
  nome text NOT NULL,
  area_solicitante text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rr_solicitante_map TO authenticated;
GRANT ALL ON public.rr_solicitante_map TO service_role;

ALTER TABLE public.rr_solicitante_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rr_solic_admin_all" ON public.rr_solicitante_map;
CREATE POLICY "rr_solic_admin_all" ON public.rr_solicitante_map
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.rr_solicitante_map (email, nome, area_solicitante) VALUES
('p.baram@rubyrose.com.br','Paloma Baram','Trade'),
('g.rocha@rubyrose.com.br','Gabi Rocha','Produto'),
('l.bazilio@rubyrose.com.br','Luana Bazilio','Produto'),
('f.menezes@rubyrose.com.br','Francelina Menezes','E-commerce'),
('f.menezes@distribuidoraunion.com.br','Francelina Menezes (alias)','E-commerce'),
('m.harumi@rubyrose.com.br','Milene Harumi','Trade'),
('n.oliveira@rubyrose.com.br','Nathalia Oliveira','E-commerce'),
('r.alves@rubyrose.com.br','Ronaldo Simões','E-commerce'),
('r.simoes@rubyrose.com.br','Ronaldo Simões (alias)','E-commerce'),
('n.freitas@rubyrose.com.br','Nathalia Freitas','Produto')
ON CONFLICT (email) DO NOTHING;

-- 3) rrtask_sync_log
CREATE TABLE IF NOT EXISTS public.rrtask_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL CHECK (action IN ('create','update','poll','error')),
  status text NOT NULL CHECK (status IN ('success','error')),
  rrtask_page_id text,
  solicitante_resolvido boolean,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rrtask_sync_log TO authenticated;
GRANT ALL ON public.rrtask_sync_log TO service_role;

ALTER TABLE public.rrtask_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rrtask_log_admin_select" ON public.rrtask_sync_log;
CREATE POLICY "rrtask_log_admin_select" ON public.rrtask_sync_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_rrtask_log_briefing
  ON public.rrtask_sync_log(briefing_id, created_at DESC);