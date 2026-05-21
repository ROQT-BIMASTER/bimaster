
CREATE TABLE public.briefing_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  campo_key text NOT NULL,
  parent_id uuid REFERENCES public.briefing_comentarios(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  mentions uuid[] NOT NULL DEFAULT '{}',
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  ai_status text NOT NULL DEFAULT 'none' CHECK (ai_status IN ('none','pending','applied','proposed','dismissed')),
  ai_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_briefing_comentarios_campo ON public.briefing_comentarios(briefing_id, campo_key, created_at);
CREATE INDEX idx_briefing_comentarios_resolved ON public.briefing_comentarios(briefing_id, resolved);
CREATE INDEX idx_briefing_comentarios_parent ON public.briefing_comentarios(parent_id);

ALTER TABLE public.briefing_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comentarios: visualizar quem tem acesso"
ON public.briefing_comentarios FOR SELECT TO authenticated
USING (public.can_access_briefing(briefing_id, auth.uid()));

CREATE POLICY "comentarios: criar autor proprio com acesso"
ON public.briefing_comentarios FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND public.can_access_briefing(briefing_id, auth.uid())
);

CREATE POLICY "comentarios: atualizar autor ou gestor"
ON public.briefing_comentarios FOR UPDATE TO authenticated
USING (
  author_id = auth.uid()
  OR public.can_manage_briefing(briefing_id, auth.uid())
)
WITH CHECK (
  author_id = auth.uid()
  OR public.can_manage_briefing(briefing_id, auth.uid())
);

CREATE POLICY "comentarios: excluir autor ou gestor"
ON public.briefing_comentarios FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR public.can_manage_briefing(briefing_id, auth.uid())
);

CREATE TRIGGER trg_briefing_comentarios_updated_at
BEFORE UPDATE ON public.briefing_comentarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.briefing_comentarios REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.briefing_comentarios;
