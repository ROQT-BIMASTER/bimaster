
-- ============ ENUM ============
DO $$ BEGIN
  CREATE TYPE public.briefing_doc_status AS ENUM ('pendente','recebido','aprovado','rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TEMPLATES ============
CREATE TABLE public.briefing_doc_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_briefing text NOT NULL,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_briefing_doc_tpl_tipo ON public.briefing_doc_checklist_templates(tipo_briefing) WHERE ativo;

ALTER TABLE public.briefing_doc_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tpl: autenticado ve ativos"
  ON public.briefing_doc_checklist_templates FOR SELECT TO authenticated
  USING (ativo OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tpl: admin insere"
  ON public.briefing_doc_checklist_templates FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tpl: admin atualiza"
  ON public.briefing_doc_checklist_templates FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tpl: admin deleta"
  ON public.briefing_doc_checklist_templates FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ TEMPLATE ITENS ============
CREATE TABLE public.briefing_doc_checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.briefing_doc_checklist_templates(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  categoria text NOT NULL DEFAULT 'geral',
  nome text NOT NULL,
  descricao text,
  obrigatorio boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_briefing_doc_tpl_itens_tpl ON public.briefing_doc_checklist_itens(template_id, ordem);

ALTER TABLE public.briefing_doc_checklist_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tpl_itens: autenticado ve"
  ON public.briefing_doc_checklist_itens FOR SELECT TO authenticated
  USING (template_id IN (
    SELECT id FROM public.briefing_doc_checklist_templates
    WHERE ativo OR has_role(auth.uid(), 'admin'::app_role)
  ));

CREATE POLICY "tpl_itens: admin escreve"
  ON public.briefing_doc_checklist_itens FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ DOCUMENTOS ============
CREATE TABLE public.briefing_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  template_item_id uuid REFERENCES public.briefing_doc_checklist_itens(id) ON DELETE SET NULL,
  categoria text NOT NULL DEFAULT 'geral',
  nome text NOT NULL,
  descricao text,
  status public.briefing_doc_status NOT NULL DEFAULT 'pendente',
  fornecedor_id uuid,
  fornecedor_nome text,
  lote text,
  data_entrega date,
  storage_path text,
  mime_type text,
  tamanho_bytes bigint,
  notion_file_url text,
  notion_page_id text,
  enviado_notion_em timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_briefing_doc_briefing ON public.briefing_documentos(briefing_id);
CREATE INDEX idx_briefing_doc_status ON public.briefing_documentos(briefing_id, status);
CREATE INDEX idx_briefing_doc_categoria ON public.briefing_documentos(briefing_id, categoria);
CREATE INDEX idx_briefing_doc_fornecedor ON public.briefing_documentos(fornecedor_id);

ALTER TABLE public.briefing_documentos ENABLE ROW LEVEL SECURITY;

-- Semi-join: acesso reflete acesso ao briefing pai
CREATE POLICY "doc: ve via briefing"
  ON public.briefing_documentos FOR SELECT TO authenticated
  USING (briefing_id IN (
    SELECT b.id FROM public.briefings b
    WHERE b.user_id = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
       OR (b.projeto_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projeto_membros pm
             WHERE pm.projeto_id = b.projeto_id AND pm.user_id = auth.uid()))
  ));

CREATE POLICY "doc: insere via briefing"
  ON public.briefing_documentos FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND briefing_id IN (
      SELECT b.id FROM public.briefings b
      WHERE b.user_id = auth.uid()
         OR has_role(auth.uid(), 'admin'::app_role)
         OR (b.projeto_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.projeto_membros pm
               WHERE pm.projeto_id = b.projeto_id AND pm.user_id = auth.uid()))
    )
  );

CREATE POLICY "doc: atualiza via briefing"
  ON public.briefing_documentos FOR UPDATE TO authenticated
  USING (briefing_id IN (
    SELECT b.id FROM public.briefings b
    WHERE b.user_id = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
       OR (b.projeto_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projeto_membros pm
             WHERE pm.projeto_id = b.projeto_id AND pm.user_id = auth.uid()))
  ));

CREATE POLICY "doc: deleta criador ou admin"
  ON public.briefing_documentos FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- updated_at triggers
CREATE TRIGGER trg_briefing_doc_tpl_updated_at
BEFORE UPDATE ON public.briefing_doc_checklist_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_briefing_documentos_updated_at
BEFORE UPDATE ON public.briefing_documentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('briefing-cofre', 'briefing-cofre', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path = <briefing_id>/<doc_id>/<filename>
-- Acesso reflete acesso ao briefing
CREATE POLICY "briefing-cofre: ve via briefing"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'briefing-cofre'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT b.id FROM public.briefings b
    WHERE b.user_id = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
       OR (b.projeto_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projeto_membros pm
             WHERE pm.projeto_id = b.projeto_id AND pm.user_id = auth.uid()))
  )
);

CREATE POLICY "briefing-cofre: insere via briefing"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'briefing-cofre'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT b.id FROM public.briefings b
    WHERE b.user_id = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
       OR (b.projeto_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projeto_membros pm
             WHERE pm.projeto_id = b.projeto_id AND pm.user_id = auth.uid()))
  )
);

CREATE POLICY "briefing-cofre: atualiza via briefing"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'briefing-cofre'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT b.id FROM public.briefings b
    WHERE b.user_id = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "briefing-cofre: deleta dono ou admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'briefing-cofre'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Seed: template "Geral" sempre disponível
INSERT INTO public.briefing_doc_checklist_templates (tipo_briefing, nome, descricao)
VALUES ('*', 'Padrão (genérico)', 'Documentos básicos aplicáveis a qualquer briefing.');
