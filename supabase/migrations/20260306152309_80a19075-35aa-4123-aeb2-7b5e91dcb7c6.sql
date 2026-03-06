
-- Enum para nível de risco
CREATE TYPE public.meeting_risk_level AS ENUM ('low', 'medium', 'high', 'critical');

-- Tabela principal de reuniões
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER,
  audio_url TEXT,
  transcription TEXT,
  summary TEXT,
  mermaid_mindmap TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','recording','processing','analyzed','error')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participantes da reunião
CREATE TABLE public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('host','participant')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, user_id)
);

-- Insights extraídos pela IA
CREATE TABLE public.meeting_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('risco','oportunidade','decisao','bloqueio','problema')),
  title TEXT NOT NULL,
  description TEXT,
  department TEXT,
  impact_level TEXT CHECK (impact_level IN ('baixo','medio','alto','critico')),
  urgency_level TEXT CHECK (urgency_level IN ('baixa','media','alta','critica')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tarefas geradas pela IA
CREATE TABLE public.meeting_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  department TEXT,
  responsible_user_id UUID REFERENCES auth.users(id),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Riscos classificados
CREATE TABLE public.meeting_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  department TEXT,
  risk_level meeting_risk_level NOT NULL DEFAULT 'medium',
  impact_level TEXT CHECK (impact_level IN ('baixo','medio','alto','critico')),
  urgency_level TEXT CHECK (urgency_level IN ('baixa','media','alta','critica')),
  recommended_action TEXT,
  responsible_user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','dismissed')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_meetings_created_by ON public.meetings(created_by);
CREATE INDEX idx_meetings_status ON public.meetings(status);
CREATE INDEX idx_meeting_participants_user ON public.meeting_participants(user_id);
CREATE INDEX idx_meeting_participants_meeting ON public.meeting_participants(meeting_id);
CREATE INDEX idx_meeting_insights_meeting ON public.meeting_insights(meeting_id);
CREATE INDEX idx_meeting_tasks_meeting ON public.meeting_tasks(meeting_id);
CREATE INDEX idx_meeting_risks_meeting ON public.meeting_risks(meeting_id);
CREATE INDEX idx_meeting_risks_status ON public.meeting_risks(status);
CREATE INDEX idx_meeting_risks_department ON public.meeting_risks(department);

-- RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_risks ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user can access a meeting
CREATE OR REPLACE FUNCTION public.can_access_meeting(_user_id UUID, _meeting_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meetings WHERE id = _meeting_id AND created_by = _user_id
    UNION ALL
    SELECT 1 FROM public.meeting_participants WHERE meeting_id = _meeting_id AND user_id = _user_id
  ) OR public.check_user_access(_user_id)
$$;

-- Meetings policies
CREATE POLICY "meetings_select" ON public.meetings FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.check_user_access(auth.uid()));

CREATE POLICY "meetings_insert" ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "meetings_update" ON public.meetings FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.check_user_access(auth.uid()));

CREATE POLICY "meetings_delete" ON public.meetings FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Meeting participants policies
CREATE POLICY "mp_select" ON public.meeting_participants FOR SELECT TO authenticated
  USING (public.can_access_meeting(auth.uid(), meeting_id));

CREATE POLICY "mp_insert" ON public.meeting_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.meetings WHERE id = meeting_id AND created_by = auth.uid()));

CREATE POLICY "mp_delete" ON public.meeting_participants FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meetings WHERE id = meeting_id AND created_by = auth.uid()));

-- Meeting insights policies
CREATE POLICY "mi_select" ON public.meeting_insights FOR SELECT TO authenticated
  USING (public.can_access_meeting(auth.uid(), meeting_id));

CREATE POLICY "mi_insert" ON public.meeting_insights FOR INSERT TO authenticated
  WITH CHECK (true);

-- Meeting tasks policies
CREATE POLICY "mt_select" ON public.meeting_tasks FOR SELECT TO authenticated
  USING (public.can_access_meeting(auth.uid(), meeting_id));

CREATE POLICY "mt_insert" ON public.meeting_tasks FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "mt_update" ON public.meeting_tasks FOR UPDATE TO authenticated
  USING (public.can_access_meeting(auth.uid(), meeting_id));

-- Meeting risks policies
CREATE POLICY "mr_select" ON public.meeting_risks FOR SELECT TO authenticated
  USING (public.can_access_meeting(auth.uid(), meeting_id));

CREATE POLICY "mr_insert" ON public.meeting_risks FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "mr_update" ON public.meeting_risks FOR UPDATE TO authenticated
  USING (public.can_access_meeting(auth.uid(), meeting_id));

-- Storage bucket for recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-recordings', 'meeting-recordings', false);

-- Storage policies
CREATE POLICY "Users can upload meeting recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meeting-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own meeting recordings"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'meeting-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own meeting recordings"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'meeting-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Revoke anon access
REVOKE ALL ON public.meetings FROM anon;
REVOKE ALL ON public.meeting_participants FROM anon;
REVOKE ALL ON public.meeting_insights FROM anon;
REVOKE ALL ON public.meeting_tasks FROM anon;
REVOKE ALL ON public.meeting_risks FROM anon;
