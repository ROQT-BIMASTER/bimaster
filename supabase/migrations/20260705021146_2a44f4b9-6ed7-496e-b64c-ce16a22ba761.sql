CREATE TABLE public.ap_reclassification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  scope text NOT NULL DEFAULT 'all_history' CHECK (scope IN ('all_history')),
  include_manual boolean NOT NULL DEFAULT true,
  use_cost_center_anchor boolean NOT NULL DEFAULT true,
  total_groups integer NOT NULL DEFAULT 0,
  processed_groups integer NOT NULL DEFAULT 0,
  success_groups integer NOT NULL DEFAULT 0,
  error_groups integer NOT NULL DEFAULT 0,
  total_accounts integer NOT NULL DEFAULT 0,
  affected_accounts integer NOT NULL DEFAULT 0,
  low_confidence_groups integer NOT NULL DEFAULT 0,
  current_group text,
  error_message text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ap_reclassification_jobs TO authenticated;
GRANT ALL ON public.ap_reclassification_jobs TO service_role;

ALTER TABLE public.ap_reclassification_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AP reclassification jobs"
ON public.ap_reclassification_jobs
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE TABLE public.ap_reclassification_job_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.ap_reclassification_jobs(id) ON DELETE CASCADE,
  group_key text NOT NULL,
  categoria_nome text NOT NULL,
  fornecedor_nome text,
  tipo_documento text,
  centro_custo_id uuid,
  centro_custo_codigo text,
  centro_custo_nome text,
  account_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  departamento_id uuid,
  departamento_nome text,
  plano_contas_id uuid,
  plano_contas_codigo text,
  plano_contas_nome text,
  confidence_score numeric,
  justification text,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, group_key)
);

GRANT SELECT ON public.ap_reclassification_job_groups TO authenticated;
GRANT ALL ON public.ap_reclassification_job_groups TO service_role;

ALTER TABLE public.ap_reclassification_job_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AP reclassification job groups"
ON public.ap_reclassification_job_groups
FOR SELECT
TO authenticated
USING (
  job_id IN (
    SELECT j.id
    FROM public.ap_reclassification_jobs j
    WHERE j.created_by = auth.uid()
  )
);

CREATE INDEX idx_ap_reclassification_jobs_created_by_created_at
ON public.ap_reclassification_jobs (created_by, created_at DESC);

CREATE INDEX idx_ap_reclassification_jobs_status
ON public.ap_reclassification_jobs (status, created_at DESC);

CREATE INDEX idx_ap_reclassification_job_groups_job_status_created
ON public.ap_reclassification_job_groups (job_id, status, created_at);

CREATE INDEX idx_ap_reclassification_job_groups_cost_center
ON public.ap_reclassification_job_groups (centro_custo_id)
WHERE centro_custo_id IS NOT NULL;

CREATE TRIGGER update_ap_reclassification_jobs_updated_at
BEFORE UPDATE ON public.ap_reclassification_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ap_reclassification_job_groups_updated_at
BEFORE UPDATE ON public.ap_reclassification_job_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ap_prepare_reclassification_job(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_groups integer := 0;
  v_total_accounts integer := 0;
BEGIN
  INSERT INTO public.ap_reclassification_job_groups (
    job_id,
    group_key,
    categoria_nome,
    fornecedor_nome,
    tipo_documento,
    centro_custo_id,
    centro_custo_codigo,
    centro_custo_nome,
    account_count
  )
  SELECT
    p_job_id,
    md5(concat_ws('|', cp.categoria_nome, coalesce(cp.fornecedor_nome, ''), coalesce(cp.tipo_documento, ''), coalesce(cp.centro_custo_id::text, ''))),
    cp.categoria_nome,
    cp.fornecedor_nome,
    cp.tipo_documento,
    cp.centro_custo_id,
    max(cc.codigo),
    max(cc.nome),
    count(*)::integer
  FROM public.contas_pagar cp
  LEFT JOIN public.centros_custo cc ON cc.id = cp.centro_custo_id
  WHERE cp.categoria_nome IS NOT NULL
  GROUP BY cp.categoria_nome, cp.fornecedor_nome, cp.tipo_documento, cp.centro_custo_id
  ON CONFLICT (job_id, group_key) DO NOTHING;

  SELECT count(*)::integer, coalesce(sum(account_count), 0)::integer
  INTO v_total_groups, v_total_accounts
  FROM public.ap_reclassification_job_groups
  WHERE job_id = p_job_id;

  UPDATE public.ap_reclassification_jobs
  SET
    total_groups = v_total_groups,
    total_accounts = v_total_accounts,
    status = CASE WHEN v_total_groups = 0 THEN 'completed' ELSE 'pending' END,
    completed_at = CASE WHEN v_total_groups = 0 THEN now() ELSE completed_at END,
    summary = jsonb_build_object('prepared_at', now(), 'total_groups', v_total_groups, 'total_accounts', v_total_accounts)
  WHERE id = p_job_id;

  RETURN jsonb_build_object('total_groups', v_total_groups, 'total_accounts', v_total_accounts);
END;
$$;

CREATE OR REPLACE FUNCTION public.ap_refresh_reclassification_job_progress(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_processed integer := 0;
  v_success integer := 0;
  v_errors integer := 0;
  v_affected integer := 0;
  v_low_conf integer := 0;
  v_pending integer := 0;
  v_status text;
BEGIN
  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE status IN ('completed', 'failed'))::integer,
    count(*) FILTER (WHERE status = 'completed')::integer,
    count(*) FILTER (WHERE status = 'failed')::integer,
    coalesce(sum(account_count) FILTER (WHERE status = 'completed'), 0)::integer,
    count(*) FILTER (WHERE status = 'completed' AND coalesce(confidence_score, 0) < 0.70)::integer,
    count(*) FILTER (WHERE status IN ('pending', 'running'))::integer
  INTO v_total, v_processed, v_success, v_errors, v_affected, v_low_conf, v_pending
  FROM public.ap_reclassification_job_groups
  WHERE job_id = p_job_id;

  SELECT status INTO v_status
  FROM public.ap_reclassification_jobs
  WHERE id = p_job_id;

  IF v_status <> 'cancelled' THEN
    v_status := CASE
      WHEN v_total = 0 THEN 'completed'
      WHEN v_pending = 0 THEN 'completed'
      ELSE 'running'
    END;
  END IF;

  UPDATE public.ap_reclassification_jobs
  SET
    status = v_status,
    total_groups = v_total,
    processed_groups = v_processed,
    success_groups = v_success,
    error_groups = v_errors,
    affected_accounts = v_affected,
    low_confidence_groups = v_low_conf,
    completed_at = CASE WHEN v_status = 'completed' AND completed_at IS NULL THEN now() ELSE completed_at END,
    summary = summary || jsonb_build_object(
      'last_progress_at', now(),
      'processed_groups', v_processed,
      'success_groups', v_success,
      'error_groups', v_errors,
      'affected_accounts', v_affected,
      'low_confidence_groups', v_low_conf
    )
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'status', v_status,
    'total_groups', v_total,
    'processed_groups', v_processed,
    'success_groups', v_success,
    'error_groups', v_errors,
    'affected_accounts', v_affected,
    'low_confidence_groups', v_low_conf
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ap_claim_reclassification_groups(p_job_id uuid, p_limit integer DEFAULT 5)
RETURNS SETOF public.ap_reclassification_job_groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.ap_reclassification_job_groups
    WHERE job_id = p_job_id
      AND status = 'pending'
    ORDER BY account_count DESC, created_at ASC
    LIMIT greatest(1, least(coalesce(p_limit, 5), 20))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.ap_reclassification_job_groups g
  SET status = 'running', updated_at = now()
  FROM picked
  WHERE g.id = picked.id
  RETURNING g.*;
END;
$$;