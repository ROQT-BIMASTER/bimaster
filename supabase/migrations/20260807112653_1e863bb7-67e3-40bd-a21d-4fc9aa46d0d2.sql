-- 1) Eventos avulsos do Calendário Geral
CREATE TABLE public.calendario_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dia_inteiro boolean NOT NULL DEFAULT true,
  hora_inicio time,
  hora_fim time,
  local text,
  cor text NOT NULL DEFAULT '#6366f1',
  categoria text NOT NULL DEFAULT 'geral',
  visibilidade text NOT NULL DEFAULT 'pessoal',
  criado_por uuid NOT NULL,
  recorrencia_id uuid,
  ocorrencia_data date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendario_eventos_visibilidade_check CHECK (visibilidade IN ('pessoal','compartilhado')),
  CONSTRAINT calendario_eventos_periodo_check CHECK (data_fim >= data_inicio)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendario_eventos TO authenticated;
GRANT ALL ON public.calendario_eventos TO service_role;

CREATE TABLE public.calendario_evento_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.calendario_eventos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  papel text NOT NULL DEFAULT 'participante',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendario_evento_participantes TO authenticated;
GRANT ALL ON public.calendario_evento_participantes TO service_role;

CREATE INDEX idx_calendario_eventos_periodo ON public.calendario_eventos (data_inicio, data_fim);
CREATE INDEX idx_calendario_eventos_criado_por ON public.calendario_eventos (criado_por);
CREATE INDEX idx_calendario_eventos_recorrencia ON public.calendario_eventos (recorrencia_id);
CREATE INDEX idx_calendario_evento_part_user ON public.calendario_evento_participantes (user_id);

ALTER TABLE public.calendario_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_evento_participantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autor e participantes veem eventos"
ON public.calendario_eventos FOR SELECT TO authenticated
USING (
  criado_por = (SELECT auth.uid())
  OR id IN (
    SELECT p.evento_id FROM public.calendario_evento_participantes p
    WHERE p.user_id = (SELECT auth.uid())
  )
  OR public.has_role((SELECT auth.uid()), 'admin')
);

CREATE POLICY "Autor cria eventos"
ON public.calendario_eventos FOR INSERT TO authenticated
WITH CHECK (criado_por = (SELECT auth.uid()));

CREATE POLICY "Autor edita eventos"
ON public.calendario_eventos FOR UPDATE TO authenticated
USING (criado_por = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (criado_por = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Autor exclui eventos"
ON public.calendario_eventos FOR DELETE TO authenticated
USING (criado_por = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Ver participantes de eventos acessiveis"
ON public.calendario_evento_participantes FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR evento_id IN (
    SELECT e.id FROM public.calendario_eventos e WHERE e.criado_por = (SELECT auth.uid())
  )
  OR public.has_role((SELECT auth.uid()), 'admin')
);

CREATE POLICY "Autor gerencia participantes"
ON public.calendario_evento_participantes FOR ALL TO authenticated
USING (
  evento_id IN (
    SELECT e.id FROM public.calendario_eventos e WHERE e.criado_por = (SELECT auth.uid())
  )
  OR public.has_role((SELECT auth.uid()), 'admin')
)
WITH CHECK (
  evento_id IN (
    SELECT e.id FROM public.calendario_eventos e WHERE e.criado_por = (SELECT auth.uid())
  )
  OR public.has_role((SELECT auth.uid()), 'admin')
);

CREATE TRIGGER trg_calendario_eventos_updated_at
BEFORE UPDATE ON public.calendario_eventos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Lembretes passam a aceitar eventos avulsos
ALTER TABLE public.calendario_lembretes
  ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES public.calendario_eventos(id) ON DELETE CASCADE;

ALTER TABLE public.calendario_lembretes ALTER COLUMN tarefa_id DROP NOT NULL;

ALTER TABLE public.calendario_lembretes
  ADD CONSTRAINT calendario_lembretes_origem_check
  CHECK (num_nonnulls(tarefa_id, evento_id) = 1);

CREATE UNIQUE INDEX IF NOT EXISTS calendario_lembretes_evento_user_key
  ON public.calendario_lembretes (evento_id, user_id) WHERE evento_id IS NOT NULL;
