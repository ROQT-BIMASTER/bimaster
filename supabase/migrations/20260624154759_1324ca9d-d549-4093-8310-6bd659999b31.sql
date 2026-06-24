-- Fase 6 da unificação Submissão↔Projeto: UNIQUE definitivo para impedir duplicatas
-- Pré-requisito (Fase 5) já consolidou as duplicatas — validado com SELECT count(*) GROUP BY HAVING > 1 = 0.
CREATE UNIQUE INDEX IF NOT EXISTS china_submissao_projetos_submissao_id_uniq
  ON public.china_submissao_projetos (submissao_id);