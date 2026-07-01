
-- =========================================================================
-- Fase 0 — Fundação do módulo de Marketing
-- =========================================================================

-- 1) mkt_marcas
CREATE TABLE public.mkt_marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  our_brand_id uuid NULL REFERENCES public.our_brands(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_marcas TO authenticated;
GRANT ALL ON public.mkt_marcas TO service_role;
ALTER TABLE public.mkt_marcas ENABLE ROW LEVEL SECURITY;

-- 2) mkt_marca_acesso
CREATE TABLE public.mkt_marca_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id uuid NOT NULL REFERENCES public.mkt_marcas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (marca_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_marca_acesso TO authenticated;
GRANT ALL ON public.mkt_marca_acesso TO service_role;
ALTER TABLE public.mkt_marca_acesso ENABLE ROW LEVEL SECURITY;

-- 3) Função de acesso (SECURITY DEFINER) — precisa existir antes das policies dos fatos
CREATE OR REPLACE FUNCTION public.tem_acesso_marca(p_marca_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.mkt_marca_acesso
      WHERE marca_id = p_marca_id AND user_id = auth.uid()
    );
$$;

-- 4) mkt_contas
CREATE TABLE public.mkt_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id uuid NOT NULL REFERENCES public.mkt_marcas(id) ON DELETE CASCADE,
  plataforma text NOT NULL CHECK (plataforma IN ('instagram','facebook','tiktok','youtube','linkedin','x')),
  handle text NOT NULL,
  external_id text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (marca_id, plataforma, handle)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_contas TO authenticated;
GRANT ALL ON public.mkt_contas TO service_role;
ALTER TABLE public.mkt_contas ENABLE ROW LEVEL SECURITY;

-- 5) mkt_metricas_conta
CREATE TABLE public.mkt_metricas_conta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.mkt_contas(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.mkt_marcas(id) ON DELETE CASCADE,
  data date NOT NULL,
  seguidores integer,
  alcance integer,
  impressoes integer,
  engajamento integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_metricas_conta TO authenticated;
GRANT ALL ON public.mkt_metricas_conta TO service_role;
ALTER TABLE public.mkt_metricas_conta ENABLE ROW LEVEL SECURITY;

-- 6) mkt_posts
CREATE TABLE public.mkt_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.mkt_contas(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.mkt_marcas(id) ON DELETE CASCADE,
  external_id text,
  publicado_em timestamptz,
  tipo text,
  permalink text,
  curtidas integer,
  comentarios integer,
  compartilhamentos integer,
  alcance integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_posts TO authenticated;
GRANT ALL ON public.mkt_posts TO service_role;
ALTER TABLE public.mkt_posts ENABLE ROW LEVEL SECURITY;

-- 7) mkt_campanhas
CREATE TABLE public.mkt_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id uuid NOT NULL REFERENCES public.mkt_marcas(id) ON DELETE CASCADE,
  plataforma text NOT NULL,
  external_id text NOT NULL,
  nome text,
  objetivo text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plataforma, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_campanhas TO authenticated;
GRANT ALL ON public.mkt_campanhas TO service_role;
ALTER TABLE public.mkt_campanhas ENABLE ROW LEVEL SECURITY;

-- 8) mkt_campanha_metricas
CREATE TABLE public.mkt_campanha_metricas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.mkt_campanhas(id) ON DELETE CASCADE,
  marca_id uuid NOT NULL REFERENCES public.mkt_marcas(id) ON DELETE CASCADE,
  data date NOT NULL,
  investimento numeric(12,2),
  impressoes integer,
  cliques integer,
  conversoes integer,
  receita numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campanha_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_campanha_metricas TO authenticated;
GRANT ALL ON public.mkt_campanha_metricas TO service_role;
ALTER TABLE public.mkt_campanha_metricas ENABLE ROW LEVEL SECURITY;

-- 9) mkt_insights_ia
CREATE TABLE public.mkt_insights_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id uuid NOT NULL REFERENCES public.mkt_marcas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  periodo_inicio date,
  periodo_fim date,
  conteudo jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_insights_ia TO authenticated;
GRANT ALL ON public.mkt_insights_ia TO service_role;
ALTER TABLE public.mkt_insights_ia ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- Índices (incluindo cobertura de FKs para não sujar o linter)
-- =========================================================================
CREATE INDEX ON public.mkt_marcas (our_brand_id);
CREATE INDEX ON public.mkt_marca_acesso (user_id);
CREATE INDEX ON public.mkt_metricas_conta (marca_id, data);
CREATE INDEX ON public.mkt_campanha_metricas (marca_id, data);
CREATE INDEX ON public.mkt_posts (marca_id, publicado_em);
CREATE INDEX ON public.mkt_campanhas (marca_id);
CREATE INDEX ON public.mkt_insights_ia (marca_id);

-- =========================================================================
-- RLS Policies
-- =========================================================================

-- mkt_marcas
CREATE POLICY "mkt_marcas select via acesso"
  ON public.mkt_marcas FOR SELECT TO authenticated
  USING (public.tem_acesso_marca(id));
CREATE POLICY "mkt_marcas admin insert"
  ON public.mkt_marcas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "mkt_marcas admin update"
  ON public.mkt_marcas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "mkt_marcas admin delete"
  ON public.mkt_marcas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- mkt_marca_acesso
CREATE POLICY "mkt_marca_acesso select own or admin"
  ON public.mkt_marca_acesso FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "mkt_marca_acesso admin insert"
  ON public.mkt_marca_acesso FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "mkt_marca_acesso admin update"
  ON public.mkt_marca_acesso FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "mkt_marca_acesso admin delete"
  ON public.mkt_marca_acesso FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fatos: mkt_contas
CREATE POLICY "mkt_contas all via acesso"
  ON public.mkt_contas FOR ALL TO authenticated
  USING (public.tem_acesso_marca(marca_id))
  WITH CHECK (public.tem_acesso_marca(marca_id));

-- mkt_metricas_conta
CREATE POLICY "mkt_metricas_conta all via acesso"
  ON public.mkt_metricas_conta FOR ALL TO authenticated
  USING (public.tem_acesso_marca(marca_id))
  WITH CHECK (public.tem_acesso_marca(marca_id));

-- mkt_posts
CREATE POLICY "mkt_posts all via acesso"
  ON public.mkt_posts FOR ALL TO authenticated
  USING (public.tem_acesso_marca(marca_id))
  WITH CHECK (public.tem_acesso_marca(marca_id));

-- mkt_campanhas
CREATE POLICY "mkt_campanhas all via acesso"
  ON public.mkt_campanhas FOR ALL TO authenticated
  USING (public.tem_acesso_marca(marca_id))
  WITH CHECK (public.tem_acesso_marca(marca_id));

-- mkt_campanha_metricas
CREATE POLICY "mkt_campanha_metricas all via acesso"
  ON public.mkt_campanha_metricas FOR ALL TO authenticated
  USING (public.tem_acesso_marca(marca_id))
  WITH CHECK (public.tem_acesso_marca(marca_id));

-- mkt_insights_ia
CREATE POLICY "mkt_insights_ia all via acesso"
  ON public.mkt_insights_ia FOR ALL TO authenticated
  USING (public.tem_acesso_marca(marca_id))
  WITH CHECK (public.tem_acesso_marca(marca_id));
