
-- 1) Marca o projeto-espelho dedicado de uma submissão
ALTER TABLE public.china_submissao_projetos
  ADD COLUMN IF NOT EXISTS is_espelho boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_china_submissao_projetos_espelho
  ON public.china_submissao_projetos (submissao_id)
  WHERE is_espelho;

-- 2) Vincula doc da China a uma tarefa do projeto-espelho (1:1)
ALTER TABLE public.china_produto_documentos
  ADD COLUMN IF NOT EXISTS projeto_tarefa_id uuid NULL
    REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_china_doc_projeto_tarefa
  ON public.china_produto_documentos (projeto_tarefa_id)
  WHERE projeto_tarefa_id IS NOT NULL;

-- 3) Catálogo de templates do checklist Brasil → China
CREATE TABLE IF NOT EXISTS public.china_checklist_brasil_china_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- itens: [{categoria, nome_documento, descricao, obrigatorio, sla_dias}]
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.china_checklist_brasil_china_templates TO authenticated;
GRANT ALL ON public.china_checklist_brasil_china_templates TO service_role;

ALTER TABLE public.china_checklist_brasil_china_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "b2c_tpl_select_auth"
  ON public.china_checklist_brasil_china_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "b2c_tpl_write_admin"
  ON public.china_checklist_brasil_china_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.check_user_access(auth.uid(), 'fabrica_china'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.check_user_access(auth.uid(), 'fabrica_china'));

-- 4) Checklist Brasil → China (itens reais por submissão)
CREATE TABLE IF NOT EXISTS public.china_checklist_brasil_china (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.china_checklist_brasil_china_templates(id) ON DELETE SET NULL,
  categoria text NOT NULL,
  nome_documento text NOT NULL,
  descricao text,
  obrigatorio boolean NOT NULL DEFAULT true,
  sla_dias integer,
  status text NOT NULL DEFAULT 'pendente',
    -- 'pendente' | 'em_preparacao' | 'enviado_china' | 'recebido_china' | 'aprovado_china' | 'devolvido_china' | 'arquivado'
  arquivo_path text,
  arquivo_nome text,
  arquivo_tamanho_bytes bigint,
  motivo_devolucao text,
  responsavel_brasil_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  projeto_tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL,
  enviado_em timestamptz,
  recebido_em timestamptz,
  respondido_em timestamptz,
  respondido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT china_b2c_status_check CHECK (
    status IN ('pendente','em_preparacao','enviado_china','recebido_china','aprovado_china','devolvido_china','arquivado')
  )
);

CREATE INDEX IF NOT EXISTS idx_china_b2c_submissao ON public.china_checklist_brasil_china(submissao_id);
CREATE INDEX IF NOT EXISTS idx_china_b2c_status ON public.china_checklist_brasil_china(status, submissao_id);
CREATE INDEX IF NOT EXISTS idx_china_b2c_tarefa ON public.china_checklist_brasil_china(projeto_tarefa_id) WHERE projeto_tarefa_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.china_checklist_brasil_china TO authenticated;
GRANT ALL ON public.china_checklist_brasil_china TO service_role;

ALTER TABLE public.china_checklist_brasil_china ENABLE ROW LEVEL SECURITY;

-- Leitura: membro do projeto-espelho OU acesso à fábrica China
CREATE POLICY "b2c_select_membro_ou_china"
  ON public.china_checklist_brasil_china
  FOR SELECT TO authenticated
  USING (
    public.check_user_access(auth.uid(), 'fabrica_china')
    OR EXISTS (
      SELECT 1
      FROM public.china_submissao_projetos sp
      JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
      WHERE sp.submissao_id = china_checklist_brasil_china.submissao_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "b2c_insert_membro_ou_china"
  ON public.china_checklist_brasil_china
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_user_access(auth.uid(), 'fabrica_china')
    OR EXISTS (
      SELECT 1
      FROM public.china_submissao_projetos sp
      JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
      WHERE sp.submissao_id = china_checklist_brasil_china.submissao_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "b2c_update_membro_ou_china"
  ON public.china_checklist_brasil_china
  FOR UPDATE TO authenticated
  USING (
    public.check_user_access(auth.uid(), 'fabrica_china')
    OR EXISTS (
      SELECT 1
      FROM public.china_submissao_projetos sp
      JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
      WHERE sp.submissao_id = china_checklist_brasil_china.submissao_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "b2c_delete_admin_ou_china"
  ON public.china_checklist_brasil_china
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_user_access(auth.uid(), 'fabrica_china')
  );

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.tg_china_b2c_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_china_b2c_updated_at ON public.china_checklist_brasil_china;
CREATE TRIGGER trg_china_b2c_updated_at
  BEFORE UPDATE ON public.china_checklist_brasil_china
  FOR EACH ROW EXECUTE FUNCTION public.tg_china_b2c_set_updated_at();

DROP TRIGGER IF EXISTS trg_china_b2c_tpl_updated_at ON public.china_checklist_brasil_china_templates;
CREATE TRIGGER trg_china_b2c_tpl_updated_at
  BEFORE UPDATE ON public.china_checklist_brasil_china_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_china_b2c_set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.china_checklist_brasil_china;
