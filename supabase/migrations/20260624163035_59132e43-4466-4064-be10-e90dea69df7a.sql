-- Propagação aditiva: Acesso e Visibilidade da submissão China -> membros do projeto vinculado.
-- Sem remoção: retirar visibilidade NÃO expulsa o usuário do projeto (pode ter tarefas/responsabilidades).

CREATE OR REPLACE FUNCTION public.tg_china_visibilidade_propaga_projeto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
  SELECT csp.projeto_id, NEW.user_id, 'membro'
  FROM public.china_submissao_projetos csp
  WHERE csp.submissao_id = NEW.submissao_id
  ON CONFLICT (projeto_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_china_visibilidade_propaga_projeto ON public.china_ficha_visibilidade;
CREATE TRIGGER trg_china_visibilidade_propaga_projeto
AFTER INSERT ON public.china_ficha_visibilidade
FOR EACH ROW
EXECUTE FUNCTION public.tg_china_visibilidade_propaga_projeto();

COMMENT ON FUNCTION public.tg_china_visibilidade_propaga_projeto() IS
  'Quando um colaborador é marcado em Acesso e Visibilidade da submissão, vira membro de todos os projetos vinculados àquela submissão. Aditivo: ON CONFLICT DO NOTHING preserva papel existente.';

CREATE OR REPLACE FUNCTION public.tg_china_submissao_projetos_propaga_visibilidade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
  SELECT NEW.projeto_id, cfv.user_id, 'membro'
  FROM public.china_ficha_visibilidade cfv
  WHERE cfv.submissao_id = NEW.submissao_id
  ON CONFLICT (projeto_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_china_submissao_projetos_propaga_visibilidade ON public.china_submissao_projetos;
CREATE TRIGGER trg_china_submissao_projetos_propaga_visibilidade
AFTER INSERT ON public.china_submissao_projetos
FOR EACH ROW
EXECUTE FUNCTION public.tg_china_submissao_projetos_propaga_visibilidade();

COMMENT ON FUNCTION public.tg_china_submissao_projetos_propaga_visibilidade() IS
  'Quando um projeto é vinculado à submissão, copia todos os usuários de china_ficha_visibilidade para projeto_membros. Aditivo.';

-- Backfill idempotente
INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
SELECT csp.projeto_id, cfv.user_id, 'membro'
FROM public.china_ficha_visibilidade cfv
JOIN public.china_submissao_projetos csp ON csp.submissao_id = cfv.submissao_id
ON CONFLICT (projeto_id, user_id) DO NOTHING;