
-- Overrides de label para categorias padrão
CREATE TABLE public.china_checklist_cat_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  categoria_key text NOT NULL,
  label_pt text NOT NULL,
  label_cn text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submissao_id, categoria_key)
);

ALTER TABLE public.china_checklist_cat_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cco_select" ON public.china_checklist_cat_overrides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cco_insert" ON public.china_checklist_cat_overrides
  FOR INSERT TO authenticated WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY "cco_update" ON public.china_checklist_cat_overrides
  FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'supervisor'::app_role))
  WITH CHECK (created_by = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'supervisor'::app_role));
CREATE POLICY "cco_delete" ON public.china_checklist_cat_overrides
  FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'supervisor'::app_role));

CREATE TRIGGER update_cco_updated_at
  BEFORE UPDATE ON public.china_checklist_cat_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Templates do Checklist de Documentos completo
CREATE TABLE public.china_doc_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  escopo text NOT NULL DEFAULT 'global' CHECK (escopo IN ('pessoal','global')),
  estrutura jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.china_doc_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cdct_select" ON public.china_doc_checklist_templates
  FOR SELECT TO authenticated
  USING (escopo = 'global' OR created_by = (SELECT auth.uid()));
CREATE POLICY "cdct_insert" ON public.china_doc_checklist_templates
  FOR INSERT TO authenticated WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY "cdct_update" ON public.china_doc_checklist_templates
  FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'supervisor'::app_role))
  WITH CHECK (created_by = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'supervisor'::app_role));
CREATE POLICY "cdct_delete" ON public.china_doc_checklist_templates
  FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'supervisor'::app_role));

CREATE TRIGGER update_cdct_updated_at
  BEFORE UPDATE ON public.china_doc_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
