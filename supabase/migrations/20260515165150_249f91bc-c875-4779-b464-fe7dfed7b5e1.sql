
-- 1) Audit log dedicado para revisões de fichas de custo
CREATE TABLE IF NOT EXISTS public.fabrica_ficha_revisoes_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id UUID NOT NULL,
  config_id UUID,
  produto_id UUID,
  user_id UUID,
  user_nome TEXT,
  acao TEXT NOT NULL,
  status_anterior TEXT,
  status_novo TEXT,
  detalhes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ficha_audit_revisao ON public.fabrica_ficha_revisoes_audit_log(revisao_id);
CREATE INDEX IF NOT EXISTS idx_ficha_audit_created ON public.fabrica_ficha_revisoes_audit_log(created_at DESC);

ALTER TABLE public.fabrica_ficha_revisoes_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users can read ficha audit" ON public.fabrica_ficha_revisoes_audit_log;
CREATE POLICY "Auth users can read ficha audit"
ON public.fabrica_ficha_revisoes_audit_log FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Auth users can insert ficha audit" ON public.fabrica_ficha_revisoes_audit_log;
CREATE POLICY "Auth users can insert ficha audit"
ON public.fabrica_ficha_revisoes_audit_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2) Trigger automático: registra cada mudança de status / inserção
CREATE OR REPLACE FUNCTION public.fn_audit_fabrica_ficha_revisoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_acao TEXT;
  v_actor UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := 'submissao';
    v_actor := COALESCE(NEW.submetido_por, v_user);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_acao := CASE NEW.status
        WHEN 'aprovada' THEN 'aprovacao'
        WHEN 'revisao_solicitada' THEN 'revisao_solicitada'
        WHEN 'pendente' THEN CASE WHEN OLD.status = 'aprovada' THEN 'cancelamento_aprovacao' ELSE 'reabertura' END
        ELSE 'status_change'
      END;
      v_actor := COALESCE(NEW.revisado_por, v_user);
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT nome INTO v_nome FROM public.profiles WHERE id = v_actor;

  INSERT INTO public.fabrica_ficha_revisoes_audit_log
    (revisao_id, config_id, produto_id, user_id, user_nome, acao, status_anterior, status_novo, detalhes)
  VALUES (
    NEW.id, NEW.config_id, NEW.produto_id, v_actor, v_nome, v_acao,
    CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status,
    jsonb_build_object(
      'versao', NEW.versao,
      'parecer', NEW.parecer,
      'custoTotal', NEW.snapshot_totais->>'custoTotal'
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_fabrica_ficha_revisoes ON public.fabrica_ficha_custo_revisoes;
CREATE TRIGGER trg_audit_fabrica_ficha_revisoes
AFTER INSERT OR UPDATE ON public.fabrica_ficha_custo_revisoes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_fabrica_ficha_revisoes();

-- 3) Backfill: registrar submissões e aprovações já existentes (sem duplicar)
INSERT INTO public.fabrica_ficha_revisoes_audit_log
  (revisao_id, config_id, produto_id, user_id, user_nome, acao, status_novo, detalhes, created_at)
SELECT r.id, r.config_id, r.produto_id, r.submetido_por, p.nome, 'submissao', 'pendente',
       jsonb_build_object('versao', r.versao, 'backfill', true), r.submetido_em
FROM public.fabrica_ficha_custo_revisoes r
LEFT JOIN public.profiles p ON p.id = r.submetido_por
WHERE r.submetido_em IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.fabrica_ficha_revisoes_audit_log a
    WHERE a.revisao_id = r.id AND a.acao = 'submissao'
  );

INSERT INTO public.fabrica_ficha_revisoes_audit_log
  (revisao_id, config_id, produto_id, user_id, user_nome, acao, status_novo, detalhes, created_at)
SELECT r.id, r.config_id, r.produto_id, r.revisado_por, p.nome,
       CASE r.status WHEN 'aprovada' THEN 'aprovacao' WHEN 'revisao_solicitada' THEN 'revisao_solicitada' ELSE 'status_change' END,
       r.status,
       jsonb_build_object('versao', r.versao, 'parecer', r.parecer, 'backfill', true),
       r.revisado_em
FROM public.fabrica_ficha_custo_revisoes r
LEFT JOIN public.profiles p ON p.id = r.revisado_por
WHERE r.revisado_em IS NOT NULL
  AND r.status IN ('aprovada','revisao_solicitada')
  AND NOT EXISTS (
    SELECT 1 FROM public.fabrica_ficha_revisoes_audit_log a
    WHERE a.revisao_id = r.id AND a.acao IN ('aprovacao','revisao_solicitada')
  );

-- 4) Normalizar snapshots aprovados: marcar ipi_incluido=true para que o helper
--    não tente recomputar IPI sobre custoTotal já final. Snapshots novos já vêm
--    com a flag; aqui cobrimos os legados que já tiveram IPI somado em outras vias.
UPDATE public.fabrica_ficha_custo_revisoes
SET snapshot_totais = jsonb_set(
  COALESCE(snapshot_totais, '{}'::jsonb),
  '{ipi_incluido}',
  'true'::jsonb,
  true
)
WHERE status = 'aprovada'
  AND COALESCE((snapshot_totais->>'ipi_incluido')::text,'false') <> 'true'
  AND COALESCE((snapshot_totais->>'totalIPI')::numeric, 0) > 0;
