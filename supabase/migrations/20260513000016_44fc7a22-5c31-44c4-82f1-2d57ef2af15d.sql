-- Tabela de configuração de SLA (prazos por etapa) da linha do tempo unificada
-- China-Brasil. Uma linha global (submissao_id IS NULL) serve de template
-- padrão; linhas com submissao_id são overrides específicos daquela submissão.

CREATE TABLE IF NOT EXISTS public.china_timeline_sla (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id  uuid REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  stage_1_dias  integer NOT NULL DEFAULT 0 CHECK (stage_1_dias  >= 0 AND stage_1_dias  <= 3650),
  stage_2_dias  integer NOT NULL DEFAULT 0 CHECK (stage_2_dias  >= 0 AND stage_2_dias  <= 3650),
  stage_3_dias  integer NOT NULL DEFAULT 0 CHECK (stage_3_dias  >= 0 AND stage_3_dias  <= 3650),
  stage_4_dias  integer NOT NULL DEFAULT 0 CHECK (stage_4_dias  >= 0 AND stage_4_dias  <= 3650),
  stage_5_dias  integer NOT NULL DEFAULT 0 CHECK (stage_5_dias  >= 0 AND stage_5_dias  <= 3650),
  stage_6_dias  integer NOT NULL DEFAULT 0 CHECK (stage_6_dias  >= 0 AND stage_6_dias  <= 3650),
  stage_7_dias  integer NOT NULL DEFAULT 0 CHECK (stage_7_dias  >= 0 AND stage_7_dias  <= 3650),
  stage_8_dias  integer NOT NULL DEFAULT 0 CHECK (stage_8_dias  >= 0 AND stage_8_dias  <= 3650),
  stage_9_dias  integer NOT NULL DEFAULT 0 CHECK (stage_9_dias  >= 0 AND stage_9_dias  <= 3650),
  stage_10_dias integer NOT NULL DEFAULT 0 CHECK (stage_10_dias >= 0 AND stage_10_dias <= 3650),
  updated_by    uuid,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  updated_at    timestamp with time zone NOT NULL DEFAULT now()
);

-- Garante no máximo um template global e um override por submissão.
CREATE UNIQUE INDEX IF NOT EXISTS china_timeline_sla_global_uniq
  ON public.china_timeline_sla ((submissao_id IS NULL))
  WHERE submissao_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS china_timeline_sla_submissao_uniq
  ON public.china_timeline_sla (submissao_id)
  WHERE submissao_id IS NOT NULL;

ALTER TABLE public.china_timeline_sla ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado.
CREATE POLICY "china_timeline_sla_select_authenticated"
  ON public.china_timeline_sla
  FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: apenas administradores.
CREATE POLICY "china_timeline_sla_insert_admin"
  ON public.china_timeline_sla
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "china_timeline_sla_update_admin"
  ON public.china_timeline_sla
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "china_timeline_sla_delete_admin"
  ON public.china_timeline_sla
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER trg_china_timeline_sla_updated_at
  BEFORE UPDATE ON public.china_timeline_sla
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();