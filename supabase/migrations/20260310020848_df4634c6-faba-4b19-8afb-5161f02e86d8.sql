
-- Table linking China submissions to Projects
CREATE TABLE public.china_submissao_projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(submissao_id, projeto_id)
);

ALTER TABLE public.china_submissao_projetos ENABLE ROW LEVEL SECURITY;

-- Members of the project can see the link
CREATE POLICY "china_submissao_projetos_select" ON public.china_submissao_projetos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projeto_membros pm WHERE pm.projeto_id = china_submissao_projetos.projeto_id AND pm.user_id = auth.uid())
    OR public.check_user_access(auth.uid(), 'fabrica_china')
  );

CREATE POLICY "china_submissao_projetos_insert" ON public.china_submissao_projetos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projeto_membros pm WHERE pm.projeto_id = china_submissao_projetos.projeto_id AND pm.user_id = auth.uid())
    OR public.check_user_access(auth.uid(), 'fabrica_china')
  );

CREATE POLICY "china_submissao_projetos_delete" ON public.china_submissao_projetos
  FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

CREATE POLICY "china_submissao_projetos_deny_anon" ON public.china_submissao_projetos
  FOR SELECT TO anon USING (false);
