
-- Trade Banners table
CREATE TABLE public.trade_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  imagem_url TEXT NOT NULL,
  link_destino TEXT,
  posicao INTEGER DEFAULT 0,
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_fim TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trade Incentivos table
CREATE TABLE public.trade_incentivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'visitas',
  meta_valor NUMERIC DEFAULT 0,
  meta_unidade TEXT DEFAULT 'unidades',
  recompensa TEXT,
  icone TEXT DEFAULT '🎯',
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '6 days'),
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trade Incentivo Progresso table
CREATE TABLE public.trade_incentivo_progresso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incentivo_id UUID REFERENCES public.trade_incentivos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  valor_atual NUMERIC DEFAULT 0,
  concluido BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(incentivo_id, user_id)
);

-- Storage bucket for trade banners
INSERT INTO storage.buckets (id, name, public) VALUES ('trade-banners', 'trade-banners', true);

-- RLS on trade_banners
ALTER TABLE public.trade_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active banners" ON public.trade_banners
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage banners" ON public.trade_banners
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS on trade_incentivos
ALTER TABLE public.trade_incentivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active incentivos" ON public.trade_incentivos
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage incentivos" ON public.trade_incentivos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS on trade_incentivo_progresso
ALTER TABLE public.trade_incentivo_progresso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress" ON public.trade_incentivo_progresso
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can upsert own progress" ON public.trade_incentivo_progresso
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own progress" ON public.trade_incentivo_progresso
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Storage policies for trade-banners bucket
CREATE POLICY "Anyone can view trade banners" ON storage.objects
  FOR SELECT USING (bucket_id = 'trade-banners');

CREATE POLICY "Admins can upload trade banners" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trade-banners' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete trade banners" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'trade-banners' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
