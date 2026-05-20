
-- 1. Pareceres da equipe TI
CREATE TABLE IF NOT EXISTS public.suporte_pareceres_ti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.suporte_tickets(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('orientacao','aceitar_solucao','parecer_tecnico','finalizar')),
  titulo text,
  parecer text NOT NULL,
  plano_correcao text,
  prazo_estimado timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suporte_pareceres_ticket ON public.suporte_pareceres_ti(ticket_id, created_at DESC);

ALTER TABLE public.suporte_pareceres_ti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read pareceres ti"
ON public.suporte_pareceres_ti FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins insert pareceres ti"
ON public.suporte_pareceres_ti FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND autor_id = auth.uid());

CREATE POLICY "admins update pareceres ti"
ON public.suporte_pareceres_ti FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. SLA e prazo no ticket
ALTER TABLE public.suporte_tickets
  ADD COLUMN IF NOT EXISTS sla_horas integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS prazo_resposta_em timestamptz;

-- Backfill: tickets existentes que não têm prazo recebem created_at + 24h
UPDATE public.suporte_tickets
SET prazo_resposta_em = created_at + interval '24 hours'
WHERE prazo_resposta_em IS NULL;

-- Trigger para definir prazo automaticamente em novos tickets
CREATE OR REPLACE FUNCTION public.set_suporte_ticket_prazo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.prazo_resposta_em IS NULL THEN
    NEW.prazo_resposta_em := NEW.created_at + (COALESCE(NEW.sla_horas, 24) || ' hours')::interval;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suporte_ticket_prazo ON public.suporte_tickets;
CREATE TRIGGER trg_suporte_ticket_prazo
  BEFORE INSERT ON public.suporte_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_suporte_ticket_prazo();
