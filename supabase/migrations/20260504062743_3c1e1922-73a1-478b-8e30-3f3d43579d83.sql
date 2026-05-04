
DO $$ BEGIN
  CREATE TYPE public.kanban_template_escopo AS ENUM ('pessoal','equipe','departamento','sistema');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.kanban_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  escopo public.kanban_template_escopo NOT NULL DEFAULT 'pessoal',
  departamento_id uuid,
  equipe_ids uuid[] NOT NULL DEFAULT '{}',
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  colunas_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  etapas_responsaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kt_owner ON public.kanban_templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_kt_escopo ON public.kanban_templates(escopo);
CREATE INDEX IF NOT EXISTS idx_kt_dep ON public.kanban_templates(departamento_id);
CREATE INDEX IF NOT EXISTS idx_kt_equipe ON public.kanban_templates USING gin(equipe_ids);

DROP TRIGGER IF EXISTS trg_kanban_templates_updated_at ON public.kanban_templates;
CREATE TRIGGER trg_kanban_templates_updated_at
  BEFORE UPDATE ON public.kanban_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.kanban_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kt_select" ON public.kanban_templates;
CREATE POLICY "kt_select" ON public.kanban_templates
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR escopo = 'sistema'
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (escopo = 'equipe' AND auth.uid() = ANY (equipe_ids))
    OR (
      escopo = 'departamento'
      AND departamento_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.departamento_id = kanban_templates.departamento_id
      )
    )
  );

DROP POLICY IF EXISTS "kt_insert" ON public.kanban_templates;
CREATE POLICY "kt_insert" ON public.kanban_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND escopo <> 'sistema'
    AND (
      escopo = 'pessoal'
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gerente'::app_role)
      OR has_role(auth.uid(), 'supervisor'::app_role)
      OR (
        projeto_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.projetos pr
          WHERE pr.id = projeto_id AND pr.criador_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "kt_update" ON public.kanban_templates;
CREATE POLICY "kt_update" ON public.kanban_templates
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (
    (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    AND escopo <> 'sistema'
  );

DROP POLICY IF EXISTS "kt_delete" ON public.kanban_templates;
CREATE POLICY "kt_delete" ON public.kanban_templates
  FOR DELETE TO authenticated
  USING (
    (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    AND escopo <> 'sistema'
  );

CREATE OR REPLACE FUNCTION public.rpc_duplicar_kanban_template(_template_id uuid, _novo_nome text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_src record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT * INTO v_src FROM public.kanban_templates WHERE id = _template_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'template não encontrado'; END IF;

  INSERT INTO public.kanban_templates(nome, descricao, escopo, owner_id, colunas_config, etapas_responsaveis)
  VALUES (
    COALESCE(_novo_nome, v_src.nome || ' (cópia)'),
    v_src.descricao,
    'pessoal',
    auth.uid(),
    v_src.colunas_config,
    v_src.etapas_responsaveis
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_duplicar_kanban_template(uuid, text) TO authenticated;

-- Seed templates do sistema (apenas se ainda não existirem)
INSERT INTO public.kanban_templates (nome, descricao, escopo, colunas_config, etapas_responsaveis)
SELECT * FROM (VALUES
  ('Padrão (genérico)', 'Em Análise · Em Revisão · Aprovado · Rejeitado', 'sistema'::public.kanban_template_escopo,
   '{"em_analise":{"label":"Em Análise","visivel":true},"em_revisao":{"label":"Em Revisão","visivel":true},"aguardando_outros":{"label":"Aguardando outros","visivel":false},"aprovado":{"label":"Aprovado","visivel":true},"rejeitado":{"label":"Rejeitado","visivel":true}}'::jsonb,
   '[]'::jsonb),
  ('Marketing & Arte', 'Briefing · Em Criação · Aprovado · Reprovado', 'sistema',
   '{"em_analise":{"label":"Briefing recebido","visivel":true},"em_revisao":{"label":"Em criação / ajustes","visivel":true},"aguardando_outros":{"label":"Aguardando cliente","visivel":true},"aprovado":{"label":"Aprovado para veiculação","visivel":true},"rejeitado":{"label":"Reprovado","visivel":true}}'::jsonb,
   '[]'::jsonb),
  ('Regulatório', 'Análise técnica · Pendências · Conforme · Não conforme', 'sistema',
   '{"em_analise":{"label":"Análise técnica","visivel":true},"em_revisao":{"label":"Pendências do dossiê","visivel":true},"aguardando_outros":{"label":"Aguardando órgão","visivel":true},"aprovado":{"label":"Conforme","visivel":true},"rejeitado":{"label":"Não conforme","visivel":true}}'::jsonb,
   '[]'::jsonb),
  ('Fábrica & PLM', 'Submissão · Ajustes BOM · Liberado · Reprovado', 'sistema',
   '{"em_analise":{"label":"Submissão","visivel":true},"em_revisao":{"label":"Ajustes de BOM/ficha","visivel":true},"aguardando_outros":{"label":"Aguardando fornecedor","visivel":true},"aprovado":{"label":"Liberado para produção","visivel":true},"rejeitado":{"label":"Reprovado","visivel":true}}'::jsonb,
   '[]'::jsonb),
  ('Financeiro', 'Recebido · Conferência · Aprovado p/ pagto · Rejeitado', 'sistema',
   '{"em_analise":{"label":"Recebido","visivel":true},"em_revisao":{"label":"Conferência / pendências","visivel":true},"aguardando_outros":{"label":"Aguardando alçada","visivel":true},"aprovado":{"label":"Aprovado para pagamento","visivel":true},"rejeitado":{"label":"Rejeitado","visivel":true}}'::jsonb,
   '[]'::jsonb)
) AS t(nome, descricao, escopo, colunas_config, etapas_responsaveis)
WHERE NOT EXISTS (SELECT 1 FROM public.kanban_templates WHERE escopo = 'sistema' AND nome = t.nome);
