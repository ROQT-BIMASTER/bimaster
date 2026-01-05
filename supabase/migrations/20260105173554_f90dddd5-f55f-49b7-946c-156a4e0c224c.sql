-- =====================================================
-- AGENTE HUGGS - ESTRUTURA DE BANCO DE DADOS
-- Sistema de Atendimento Inteligente via IA
-- =====================================================

-- 1. Tabela de Configuração do Agente
CREATE TABLE public.huggs_agent_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Agente Huggs',
    description TEXT DEFAULT 'Assistente de análise de dados empresariais',
    system_prompt TEXT,
    model TEXT DEFAULT 'gpt-4.1-mini',
    temperature NUMERIC(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4000,
    n8n_workflow_id TEXT DEFAULT 'VNwAIzkTcgoGzhIa',
    n8n_webhook_url TEXT,
    is_active BOOLEAN DEFAULT true,
    capabilities JSONB DEFAULT '["reports", "charts", "data_analysis", "lovable_mcp"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Tabela de Sessões de Chat
CREATE TABLE public.huggs_chat_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'Nova Conversa',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
    department TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_message_at TIMESTAMPTZ,
    messages_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela de Mensagens
CREATE TABLE public.huggs_chat_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.huggs_chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'markdown', 'html', 'chart', 'report', 'image')),
    tool_calls JSONB,
    tool_results JSONB,
    tokens_used INTEGER,
    latency_ms INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabela de Relatórios Gerados
CREATE TABLE public.huggs_reports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.huggs_chat_sessions(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.huggs_chat_messages(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    report_type TEXT DEFAULT 'general',
    content TEXT,
    format TEXT DEFAULT 'html' CHECK (format IN ('html', 'markdown', 'pdf', 'json')),
    department TEXT,
    date_range JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tabela de Gráficos Gerados
CREATE TABLE public.huggs_charts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.huggs_chat_sessions(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.huggs_chat_messages(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    chart_type TEXT NOT NULL CHECK (chart_type IN ('bar', 'line', 'pie', 'area', 'scatter', 'radar', 'composed')),
    chart_config JSONB NOT NULL,
    data JSONB NOT NULL,
    department TEXT,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Tabela de Feedback
CREATE TABLE public.huggs_feedback (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES public.huggs_chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_type TEXT CHECK (feedback_type IN ('helpful', 'not_helpful', 'incorrect', 'suggestion')),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Tabela de Uso/Analytics
CREATE TABLE public.huggs_usage_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.huggs_chat_sessions(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    latency_ms INTEGER,
    tool_used TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX idx_huggs_sessions_user ON public.huggs_chat_sessions(user_id);
CREATE INDEX idx_huggs_sessions_status ON public.huggs_chat_sessions(status);
CREATE INDEX idx_huggs_sessions_created ON public.huggs_chat_sessions(created_at DESC);
CREATE INDEX idx_huggs_messages_session ON public.huggs_chat_messages(session_id);
CREATE INDEX idx_huggs_messages_created ON public.huggs_chat_messages(created_at);
CREATE INDEX idx_huggs_reports_user ON public.huggs_reports(user_id);
CREATE INDEX idx_huggs_charts_user ON public.huggs_charts(user_id);
CREATE INDEX idx_huggs_usage_user ON public.huggs_usage_logs(user_id);
CREATE INDEX idx_huggs_usage_created ON public.huggs_usage_logs(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.huggs_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huggs_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huggs_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huggs_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huggs_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huggs_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huggs_usage_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para huggs_agent_config (somente admins podem modificar)
CREATE POLICY "Todos podem ver configuração do agente" 
    ON public.huggs_agent_config FOR SELECT 
    USING (true);

CREATE POLICY "Admins podem gerenciar configuração" 
    ON public.huggs_agent_config FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'supervisor')
        )
    );

-- Políticas para huggs_chat_sessions
CREATE POLICY "Usuários veem suas próprias sessões" 
    ON public.huggs_chat_sessions FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Usuários criam suas sessões" 
    ON public.huggs_chat_sessions FOR INSERT 
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários atualizam suas sessões" 
    ON public.huggs_chat_sessions FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "Usuários deletam suas sessões" 
    ON public.huggs_chat_sessions FOR DELETE 
    USING (user_id = auth.uid());

-- Políticas para huggs_chat_messages
CREATE POLICY "Usuários veem mensagens de suas sessões" 
    ON public.huggs_chat_messages FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.huggs_chat_sessions 
            WHERE id = session_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Usuários inserem mensagens em suas sessões" 
    ON public.huggs_chat_messages FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.huggs_chat_sessions 
            WHERE id = session_id AND user_id = auth.uid()
        )
    );

-- Políticas para huggs_reports
CREATE POLICY "Usuários veem seus relatórios" 
    ON public.huggs_reports FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Usuários criam seus relatórios" 
    ON public.huggs_reports FOR INSERT 
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários atualizam seus relatórios" 
    ON public.huggs_reports FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "Usuários deletam seus relatórios" 
    ON public.huggs_reports FOR DELETE 
    USING (user_id = auth.uid());

-- Políticas para huggs_charts
CREATE POLICY "Usuários veem seus gráficos" 
    ON public.huggs_charts FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Usuários criam seus gráficos" 
    ON public.huggs_charts FOR INSERT 
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários deletam seus gráficos" 
    ON public.huggs_charts FOR DELETE 
    USING (user_id = auth.uid());

-- Políticas para huggs_feedback
CREATE POLICY "Usuários veem seu feedback" 
    ON public.huggs_feedback FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Usuários criam feedback" 
    ON public.huggs_feedback FOR INSERT 
    WITH CHECK (user_id = auth.uid());

-- Políticas para huggs_usage_logs (usuários veem seus logs, admins veem todos)
CREATE POLICY "Usuários veem seus logs" 
    ON public.huggs_usage_logs FOR SELECT 
    USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Sistema insere logs" 
    ON public.huggs_usage_logs FOR INSERT 
    WITH CHECK (true);

-- =====================================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- =====================================================

-- Trigger para atualizar updated_at em config
CREATE TRIGGER update_huggs_config_updated_at
    BEFORE UPDATE ON public.huggs_agent_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar updated_at em sessions
CREATE TRIGGER update_huggs_sessions_updated_at
    BEFORE UPDATE ON public.huggs_chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar contador e last_message_at na sessão
CREATE OR REPLACE FUNCTION public.update_huggs_session_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.huggs_chat_sessions 
    SET 
        messages_count = messages_count + 1,
        last_message_at = NEW.created_at,
        updated_at = now()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_huggs_session_on_message
    AFTER INSERT ON public.huggs_chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_huggs_session_stats();

-- =====================================================
-- CONFIGURAÇÃO INICIAL
-- =====================================================

INSERT INTO public.huggs_agent_config (
    name,
    description,
    system_prompt,
    model,
    n8n_workflow_id,
    n8n_webhook_url,
    capabilities
) VALUES (
    'Agente Huggs',
    'Assistente de análise de dados empresariais especializado no sistema Lovable',
    'Você é o Agente Huggs, um assistente de análise de dados empresariais. Ajude usuários com relatórios, gráficos e insights de negócios.',
    'gpt-4.1-mini',
    'VNwAIzkTcgoGzhIa',
    'https://huggs.app.n8n.cloud/webhook/chat',
    '["reports", "charts", "data_analysis", "lovable_mcp", "department_analytics"]'::jsonb
);