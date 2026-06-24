-- Fase 9: uniformiza is_espelho=true (UNIQUE garante 1 vínculo por submissão = fonte única)

-- 1) Backfill do único vínculo legado restante
UPDATE public.china_submissao_projetos
SET is_espelho = true
WHERE is_espelho = false;

-- 2) Default para novos vínculos
ALTER TABLE public.china_submissao_projetos
  ALTER COLUMN is_espelho SET DEFAULT true;

-- 3) Validação: zero vínculos com is_espelho=false esperados
DO $$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM public.china_submissao_projetos WHERE is_espelho = false;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Backfill falhou: ainda há % vínculo(s) com is_espelho=false', v_n;
  END IF;
END $$;