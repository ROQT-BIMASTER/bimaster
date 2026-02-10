
-- ================================================
-- CRM Omnichannel Tables
-- ================================================

-- 1. Lead Subtasks
CREATE TABLE public.lead_subtasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  responsavel_id uuid REFERENCES public.profiles(id),
  checklist jsonb DEFAULT '[]'::jsonb,
  data_entrega date,
  concluida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_subtasks_select" ON public.lead_subtasks FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'vendas') OR EXISTS (
    SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.vendedor_id = auth.uid()
  ));
CREATE POLICY "lead_subtasks_insert" ON public.lead_subtasks FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'vendas') OR EXISTS (
    SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.vendedor_id = auth.uid()
  ));
CREATE POLICY "lead_subtasks_update" ON public.lead_subtasks FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'vendas') OR EXISTS (
    SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.vendedor_id = auth.uid()
  ));
CREATE POLICY "lead_subtasks_delete" ON public.lead_subtasks FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.vendedor_id = auth.uid()
  ));
CREATE POLICY "lead_subtasks_deny_anon" ON public.lead_subtasks FOR SELECT TO anon USING (false);

-- 2. Lead Messages (WhatsApp simulado)
CREATE TABLE public.lead_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'text' CHECK (tipo IN ('text', 'audio', 'image')),
  conteudo text NOT NULL,
  direcao text NOT NULL DEFAULT 'inbound' CHECK (direcao IN ('inbound', 'outbound')),
  remetente_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_messages_select" ON public.lead_messages FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'vendas') OR EXISTS (
    SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.vendedor_id = auth.uid()
  ));
CREATE POLICY "lead_messages_insert" ON public.lead_messages FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'vendas') OR EXISTS (
    SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.vendedor_id = auth.uid()
  ));
CREATE POLICY "lead_messages_delete" ON public.lead_messages FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));
CREATE POLICY "lead_messages_deny_anon" ON public.lead_messages FOR SELECT TO anon USING (false);

-- 3. Lead Activity Logs (Auditoria)
CREATE TABLE public.lead_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  acao text NOT NULL,
  detalhes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_activity_logs_select" ON public.lead_activity_logs FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'vendas') OR EXISTS (
    SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.vendedor_id = auth.uid()
  ));
CREATE POLICY "lead_activity_logs_insert" ON public.lead_activity_logs FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "lead_activity_logs_deny_anon" ON public.lead_activity_logs FOR SELECT TO anon USING (false);

-- 4. Internal Tickets (Central de Demandas)
CREATE TABLE public.internal_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'concluido')),
  responsavel_id uuid REFERENCES public.profiles(id),
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_tickets_select" ON public.internal_tickets FOR SELECT TO authenticated
  USING (
    criado_por = auth.uid() OR responsavel_id = auth.uid() OR public.check_user_access(auth.uid())
  );
CREATE POLICY "internal_tickets_insert" ON public.internal_tickets FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "internal_tickets_update" ON public.internal_tickets FOR UPDATE TO authenticated
  USING (
    criado_por = auth.uid() OR responsavel_id = auth.uid() OR public.check_user_access(auth.uid())
  );
CREATE POLICY "internal_tickets_delete" ON public.internal_tickets FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));
CREATE POLICY "internal_tickets_deny_anon" ON public.internal_tickets FOR SELECT TO anon USING (false);

-- Triggers for updated_at
CREATE TRIGGER update_lead_subtasks_updated_at BEFORE UPDATE ON public.lead_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_internal_tickets_updated_at BEFORE UPDATE ON public.internal_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for activity logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_tickets;
