
-- =========================================================
-- Checklist de Embalagens — China Module
-- =========================================================

-- 1) Checklist por submissão
CREATE TABLE public.china_produto_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id UUID NOT NULL UNIQUE REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  colunas JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_china_checklist_sub ON public.china_produto_checklist(submissao_id);

ALTER TABLE public.china_produto_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_select" ON public.china_produto_checklist
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "checklist_insert" ON public.china_produto_checklist
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = submissao_id
      AND (s.created_by = auth.uid()
           OR is_admin_or_supervisor(auth.uid())
           OR check_user_access(auth.uid(), 'fabrica'))
  ));

CREATE POLICY "checklist_update" ON public.china_produto_checklist
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = submissao_id
      AND (s.created_by = auth.uid()
           OR is_admin_or_supervisor(auth.uid())
           OR check_user_access(auth.uid(), 'fabrica'))
  ));

CREATE POLICY "checklist_delete" ON public.china_produto_checklist
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = submissao_id
      AND (s.created_by = auth.uid()
           OR is_admin_or_supervisor(auth.uid())
           OR check_user_access(auth.uid(), 'fabrica'))
  ));

CREATE TRIGGER trg_china_checklist_updated_at
  BEFORE UPDATE ON public.china_produto_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Células (linha = cor, coluna = item)
CREATE TABLE public.china_produto_checklist_celulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.china_produto_checklist(id) ON DELETE CASCADE,
  cor_id UUID NOT NULL REFERENCES public.china_produto_cores(id) ON DELETE CASCADE,
  coluna_key TEXT NOT NULL,
  marcado BOOLEAN NOT NULL DEFAULT false,
  mockup_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (checklist_id, cor_id, coluna_key)
);

CREATE INDEX idx_checklist_celulas_checklist ON public.china_produto_checklist_celulas(checklist_id);

ALTER TABLE public.china_produto_checklist_celulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_celulas_select" ON public.china_produto_checklist_celulas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "checklist_celulas_write" ON public.china_produto_checklist_celulas
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.china_produto_checklist c
    JOIN public.china_produto_submissoes s ON s.id = c.submissao_id
    WHERE c.id = checklist_id
      AND (s.created_by = auth.uid()
           OR is_admin_or_supervisor(auth.uid())
           OR check_user_access(auth.uid(), 'fabrica'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.china_produto_checklist c
    JOIN public.china_produto_submissoes s ON s.id = c.submissao_id
    WHERE c.id = checklist_id
      AND (s.created_by = auth.uid()
           OR is_admin_or_supervisor(auth.uid())
           OR check_user_access(auth.uid(), 'fabrica'))
  ));

CREATE TRIGGER trg_checklist_celulas_updated_at
  BEFORE UPDATE ON public.china_produto_checklist_celulas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Templates reutilizáveis (escopados por marca)
CREATE TABLE public.china_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca TEXT,
  nome TEXT NOT NULL,
  colunas JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_templates_marca ON public.china_checklist_templates(marca);

ALTER TABLE public.china_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_tpl_select" ON public.china_checklist_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "checklist_tpl_insert" ON public.china_checklist_templates
  FOR INSERT TO authenticated
  WITH CHECK (check_user_access(auth.uid(), 'fabrica') OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "checklist_tpl_update" ON public.china_checklist_templates
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "checklist_tpl_delete" ON public.china_checklist_templates
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE TRIGGER trg_checklist_tpl_updated_at
  BEFORE UPDATE ON public.china_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
