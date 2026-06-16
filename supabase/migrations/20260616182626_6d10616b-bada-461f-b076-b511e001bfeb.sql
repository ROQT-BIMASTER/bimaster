
CREATE TABLE public.projeto_submissao_planilha_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nome text NOT NULL DEFAULT 'Padrão',
  colunas jsonb NOT NULL DEFAULT '[]'::jsonb,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  agrupar_por text,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_psp_config_projeto_user ON public.projeto_submissao_planilha_config(projeto_id, user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_submissao_planilha_config TO authenticated;
GRANT ALL ON public.projeto_submissao_planilha_config TO service_role;
ALTER TABLE public.projeto_submissao_planilha_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psp_config_select_membros" ON public.projeto_submissao_planilha_config FOR SELECT TO authenticated
USING (
  projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "psp_config_write_self" ON public.projeto_submissao_planilha_config FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.projeto_submissao_planilha_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  cor text,
  observacao text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (projeto_id, submissao_id)
);
CREATE INDEX idx_psp_status_projeto ON public.projeto_submissao_planilha_status(projeto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_submissao_planilha_status TO authenticated;
GRANT ALL ON public.projeto_submissao_planilha_status TO service_role;
ALTER TABLE public.projeto_submissao_planilha_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psp_status_select_membros" ON public.projeto_submissao_planilha_status FOR SELECT TO authenticated
USING (
  projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "psp_status_write_membros" ON public.projeto_submissao_planilha_status FOR ALL TO authenticated
USING (
  projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TABLE public.projeto_submissao_planilha_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  campo text NOT NULL,
  valor jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (projeto_id, submissao_id, campo)
);
CREATE INDEX idx_psp_overrides_projeto ON public.projeto_submissao_planilha_overrides(projeto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_submissao_planilha_overrides TO authenticated;
GRANT ALL ON public.projeto_submissao_planilha_overrides TO service_role;
ALTER TABLE public.projeto_submissao_planilha_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psp_overrides_select_membros" ON public.projeto_submissao_planilha_overrides FOR SELECT TO authenticated
USING (
  projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "psp_overrides_write_membros" ON public.projeto_submissao_planilha_overrides FOR ALL TO authenticated
USING (
  projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE OR REPLACE FUNCTION public.tg_psp_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_psp_config_uat BEFORE UPDATE ON public.projeto_submissao_planilha_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_psp_set_updated_at();
CREATE TRIGGER trg_psp_status_uat BEFORE UPDATE ON public.projeto_submissao_planilha_status
  FOR EACH ROW EXECUTE FUNCTION public.tg_psp_set_updated_at();
CREATE TRIGGER trg_psp_overrides_uat BEFORE UPDATE ON public.projeto_submissao_planilha_overrides
  FOR EACH ROW EXECUTE FUNCTION public.tg_psp_set_updated_at();
