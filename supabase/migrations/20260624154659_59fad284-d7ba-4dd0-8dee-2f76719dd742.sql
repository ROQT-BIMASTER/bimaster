-- ALLOW-DESTRUCTIVE: consolidação Fase 5 — remove vínculos duplicados de submissão↔projeto após decisão humana (Opção B). Projetos não são deletados; apenas arquivados com auditoria. (BIM-UNIF-SUBPROJ-F5)

-- 1) Coluna de metadados em projetos (idempotente) para gravar auditoria de unificação
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Arquivar projetos descartados — submissão 'compact powder' (e688df80) canônico = a22e1661
UPDATE public.projetos
SET status = 'arquivado',
    metadata = metadata
      || jsonb_build_object(
        'unificado_em', 'a22e1661-aae2-4d8e-bd89-3983fd27a846',
        'unificado_em_submissao', 'e688df80-1854-471b-8e2e-8c3431f0da90',
        'unificado_at', now(),
        'unificacao_fase', 'fase-5-opcao-b',
        'unificacao_motivo', 'Duplicata de submissão; canônico escolhido por decisão humana (maior volume de tarefas).'
      ),
    updated_at = now()
WHERE id IN (
  '3db30522-c78c-4b2f-b4e2-f804c93cf1b6',
  '1ab3b853-78df-4b31-9024-adcda34e0e92',
  '857f5f4d-e499-4797-9dce-6727eebcca27'
)
AND status = 'ativo';

-- 3) Arquivar projeto descartado — submissão 'liquid eyeliner' (979ea07a) canônico = 299994ec
UPDATE public.projetos
SET status = 'arquivado',
    metadata = metadata
      || jsonb_build_object(
        'unificado_em', '299994ec-0b75-4408-80b8-49b1f27103b2',
        'unificado_em_submissao', '979ea07a-f6ce-43e5-a457-352ed6265079',
        'unificado_at', now(),
        'unificacao_fase', 'fase-5-opcao-b',
        'unificacao_motivo', 'Duplicata de submissão; canônico escolhido por decisão humana (maior volume de tarefas).'
      ),
    updated_at = now()
WHERE id = 'a1e8b158-615e-4055-826b-f76032a2ca4a'
AND status = 'ativo';

-- 4) Remover vínculos extras em china_submissao_projetos (mantém só o canônico por submissão)
-- Submissão compact powder
DELETE FROM public.china_submissao_projetos
WHERE submissao_id = 'e688df80-1854-471b-8e2e-8c3431f0da90'
  AND projeto_id IN (
    '3db30522-c78c-4b2f-b4e2-f804c93cf1b6',
    '1ab3b853-78df-4b31-9024-adcda34e0e92',
    '857f5f4d-e499-4797-9dce-6727eebcca27'
  );

-- Submissão liquid eyeliner
DELETE FROM public.china_submissao_projetos
WHERE submissao_id = '979ea07a-f6ce-43e5-a457-352ed6265079'
  AND projeto_id = 'a1e8b158-615e-4055-826b-f76032a2ca4a';

-- 5) Marcar vínculo remanescente como espelho oficial (fonte única)
UPDATE public.china_submissao_projetos
SET is_espelho = true
WHERE (submissao_id = 'e688df80-1854-471b-8e2e-8c3431f0da90' AND projeto_id = 'a22e1661-aae2-4d8e-bd89-3983fd27a846')
   OR (submissao_id = '979ea07a-f6ce-43e5-a457-352ed6265079' AND projeto_id = '299994ec-0b75-4408-80b8-49b1f27103b2');

-- 6) Verificação pós-consolidação (deve retornar 0)
DO $$
DECLARE
  v_dup int;
BEGIN
  SELECT count(*) INTO v_dup
  FROM (
    SELECT submissao_id FROM public.china_submissao_projetos
    GROUP BY submissao_id HAVING count(*) > 1
  ) s;
  IF v_dup <> 0 THEN
    RAISE EXCEPTION 'Consolidação falhou: ainda há % submissão(ões) com vínculo duplicado', v_dup;
  END IF;
END $$;