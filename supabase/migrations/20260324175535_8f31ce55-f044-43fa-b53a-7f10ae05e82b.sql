
-- =============================================
-- 1. process_decisions: Decisões Internacionais Formais
-- =============================================
CREATE TABLE public.process_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL,
  submissao_id uuid,
  origin text NOT NULL CHECK (origin IN ('brasil', 'china')),
  destination text NOT NULL CHECK (destination IN ('brasil', 'china')),
  decision_type text NOT NULL CHECK (decision_type IN ('approved', 'rejected', 'needs_revision')),
  message text NOT NULL,
  items_affected jsonb DEFAULT '[]'::jsonb,
  attachments jsonb DEFAULT '[]'::jsonb,
  prazo_retorno timestamptz,
  version integer NOT NULL DEFAULT 1,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz NOT NULL DEFAULT now(),
  parent_decision_id uuid REFERENCES public.process_decisions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_process_decisions_process ON public.process_decisions(process_id);
CREATE INDEX idx_process_decisions_submissao ON public.process_decisions(submissao_id);
CREATE INDEX idx_process_decisions_destination ON public.process_decisions(destination, decision_type);

-- RLS
ALTER TABLE public.process_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view process decisions"
  ON public.process_decisions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert process decisions"
  ON public.process_decisions FOR INSERT TO authenticated
  WITH CHECK (decided_by = auth.uid());

-- Auto-version trigger
CREATE OR REPLACE FUNCTION public.fn_process_decision_auto_version()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO NEW.version
  FROM public.process_decisions
  WHERE process_id = NEW.process_id;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_process_decision_auto_version
  BEFORE INSERT ON public.process_decisions
  FOR EACH ROW EXECUTE FUNCTION public.fn_process_decision_auto_version();

-- =============================================
-- 2. process_field_permissions: Permissões por Etapa+Campo
-- =============================================
CREATE TABLE public.process_field_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_step text NOT NULL,
  module text NOT NULL,
  field text NOT NULL,
  origin_role text NOT NULL CHECK (origin_role IN ('china', 'brasil')),
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (process_step, module, field, origin_role)
);

CREATE INDEX idx_pfp_step_module ON public.process_field_permissions(process_step, module);

ALTER TABLE public.process_field_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view field permissions"
  ON public.process_field_permissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage field permissions"
  ON public.process_field_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Revoke anon access
REVOKE ALL ON public.process_decisions FROM anon;
REVOKE ALL ON public.process_field_permissions FROM anon;
