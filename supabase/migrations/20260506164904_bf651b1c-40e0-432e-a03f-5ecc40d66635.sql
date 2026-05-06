
-- 1. Filtros salvos do monitor
CREATE TABLE public.china_recebimento_filtros_salvos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.china_recebimento_filtros_salvos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "filtros_owner_select" ON public.china_recebimento_filtros_salvos
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "filtros_owner_insert" ON public.china_recebimento_filtros_salvos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "filtros_owner_update" ON public.china_recebimento_filtros_salvos
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "filtros_owner_delete" ON public.china_recebimento_filtros_salvos
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_filtros_recebimento_updated
  BEFORE UPDATE ON public.china_recebimento_filtros_salvos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- garantir único default por usuário
CREATE UNIQUE INDEX uniq_filtros_default_user
  ON public.china_recebimento_filtros_salvos (user_id)
  WHERE is_default = true;

-- 2. Configuração SLA (linha única)
CREATE TABLE public.china_sla_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_porto_cd_dias_alvo integer NOT NULL DEFAULT 7,
  sla_porto_cd_dias_critico integer NOT NULL DEFAULT 15,
  dias_atraso_alerta integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.china_sla_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_config_select_all" ON public.china_sla_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sla_config_admin_write" ON public.china_sla_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

INSERT INTO public.china_sla_config (sla_porto_cd_dias_alvo, sla_porto_cd_dias_critico, dias_atraso_alerta)
VALUES (7, 15, 1);

CREATE TRIGGER trg_sla_config_updated
  BEFORE UPDATE ON public.china_sla_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Alertas de recebimento
CREATE TABLE public.china_recebimento_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id uuid NOT NULL REFERENCES public.china_ordens_compra(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('sla_estourado','entrega_atrasada')),
  severidade text NOT NULL DEFAULT 'media' CHECK (severidade IN ('baixa','media','alta','critica')),
  mensagem text NOT NULL,
  responsavel_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  lido_em timestamptz,
  resolvido_em timestamptz,
  UNIQUE (ordem_compra_id, tipo)
);
CREATE INDEX idx_alertas_responsavel ON public.china_recebimento_alertas (responsavel_id, lido_em);
CREATE INDEX idx_alertas_oc ON public.china_recebimento_alertas (ordem_compra_id);

ALTER TABLE public.china_recebimento_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alertas_select" ON public.china_recebimento_alertas
  FOR SELECT TO authenticated
  USING (
    responsavel_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  );
CREATE POLICY "alertas_update_own" ON public.china_recebimento_alertas
  FOR UPDATE TO authenticated
  USING (
    responsavel_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  );
CREATE POLICY "alertas_admin_write" ON public.china_recebimento_alertas
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "alertas_admin_delete" ON public.china_recebimento_alertas
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.china_recebimento_alertas;

-- 4. Campos extras NCs
ALTER TABLE public.china_nao_conformidades
  ADD COLUMN IF NOT EXISTS iniciada_em timestamptz,
  ADD COLUMN IF NOT EXISTS iniciada_por uuid,
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;
