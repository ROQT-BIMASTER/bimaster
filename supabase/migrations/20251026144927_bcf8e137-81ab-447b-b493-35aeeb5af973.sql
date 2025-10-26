-- Tabela para histórico de ligações com IA
CREATE TABLE IF NOT EXISTS public.ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  vendedor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  call_duration INTEGER, -- duração em segundos
  call_status TEXT NOT NULL CHECK (call_status IN ('in_progress', 'completed', 'failed', 'interrupted')),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  meeting_scheduled BOOLEAN DEFAULT false,
  meeting_date TIMESTAMPTZ,
  transcript TEXT,
  summary TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para transcrições detalhadas em tempo real
CREATE TABLE IF NOT EXISTS public.ai_call_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.ai_calls(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL CHECK (speaker IN ('ai', 'prospect')),
  message TEXT NOT NULL,
  timestamp_ms INTEGER NOT NULL, -- milissegundos desde início da call
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para ações tomadas pela IA durante a ligação
CREATE TABLE IF NOT EXISTS public.ai_call_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.ai_calls(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('meeting_scheduled', 'objection_handled', 'info_captured', 'status_updated', 'note_saved')),
  action_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para disponibilidade dos vendedores (para agendamento)
CREATE TABLE IF NOT EXISTS public.vendor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=domingo, 6=sábado
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendedor_id, day_of_week, start_time)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ai_calls_prospect_id ON public.ai_calls(prospect_id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_vendedor_id ON public.ai_calls(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_created_at ON public.ai_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_call_transcriptions_call_id ON public.ai_call_transcriptions(call_id);
CREATE INDEX IF NOT EXISTS idx_ai_call_actions_call_id ON public.ai_call_actions(call_id);
CREATE INDEX IF NOT EXISTS idx_vendor_availability_vendedor ON public.vendor_availability(vendedor_id);

-- Habilitar RLS
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_availability ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ai_calls
CREATE POLICY "Vendedores veem suas próprias ligações" 
  ON public.ai_calls FOR SELECT 
  USING (
    auth.uid() = vendedor_id OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Vendedores criam suas próprias ligações" 
  ON public.ai_calls FOR INSERT 
  WITH CHECK (auth.uid() = vendedor_id);

CREATE POLICY "Vendedores atualizam suas próprias ligações" 
  ON public.ai_calls FOR UPDATE 
  USING (auth.uid() = vendedor_id);

-- Políticas RLS para ai_call_transcriptions
CREATE POLICY "Acesso a transcrições via call" 
  ON public.ai_call_transcriptions FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_calls 
      WHERE ai_calls.id = ai_call_transcriptions.call_id 
      AND (
        ai_calls.vendedor_id = auth.uid() OR
        has_role(auth.uid(), 'admin') OR
        has_role(auth.uid(), 'supervisor')
      )
    )
  );

-- Políticas RLS para ai_call_actions
CREATE POLICY "Acesso a ações via call" 
  ON public.ai_call_actions FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_calls 
      WHERE ai_calls.id = ai_call_actions.call_id 
      AND (
        ai_calls.vendedor_id = auth.uid() OR
        has_role(auth.uid(), 'admin') OR
        has_role(auth.uid(), 'supervisor')
      )
    )
  );

-- Políticas RLS para vendor_availability
CREATE POLICY "Todos podem ver disponibilidade" 
  ON public.vendor_availability FOR SELECT 
  USING (true);

CREATE POLICY "Vendedores gerenciam sua disponibilidade" 
  ON public.vendor_availability FOR ALL 
  USING (auth.uid() = vendedor_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_ai_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_ai_calls_updated_at
  BEFORE UPDATE ON public.ai_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_calls_updated_at();