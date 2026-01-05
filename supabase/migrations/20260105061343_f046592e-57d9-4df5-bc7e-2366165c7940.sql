-- Tabela para resultados de testes de QA
CREATE TABLE public.qa_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_type TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'warning', 'running')),
  message TEXT,
  duration_ms INTEGER,
  details JSONB,
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para problemas identificados
CREATE TABLE public.qa_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  suggested_fix TEXT,
  auto_fixable BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'ignored', 'in_progress')),
  fixed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  fixed_at TIMESTAMPTZ
);

-- Tabela para sessões de chat do QA
CREATE TABLE public.qa_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  tests_run INTEGER DEFAULT 0,
  tests_passed INTEGER DEFAULT 0,
  tests_failed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_qa_test_results_session ON qa_test_results(session_id);
CREATE INDEX idx_qa_test_results_created ON qa_test_results(created_at DESC);
CREATE INDEX idx_qa_issues_status ON qa_issues(status);
CREATE INDEX idx_qa_issues_severity ON qa_issues(severity);

-- Enable RLS
ALTER TABLE qa_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Apenas usuários autenticados podem ver/criar
CREATE POLICY "Authenticated users can view qa_test_results" ON qa_test_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert qa_test_results" ON qa_test_results FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view qa_issues" ON qa_issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert qa_issues" ON qa_issues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update qa_issues" ON qa_issues FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view own qa_chat_sessions" ON qa_chat_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own qa_chat_sessions" ON qa_chat_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own qa_chat_sessions" ON qa_chat_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);