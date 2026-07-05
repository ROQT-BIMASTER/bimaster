-- Fix R06 (min(uuid) inexistente) e R15 (round(real,int) inexistente) na fn_despesa_detectar
DO $mig$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc WHERE proname = 'fn_despesa_detectar' AND pronamespace = 'public'::regnamespace;

  -- R06: substituir MIN(plano_contas_id) por (array_agg(plano_contas_id ORDER BY plano_contas_id))[1]
  v_def := replace(v_def,
    'MIN(plano_contas_id) AS plano_contas_id',
    '(array_agg(plano_contas_id ORDER BY plano_contas_id))[1] AS plano_contas_id');

  -- R15: round(real, int) -> cast para numeric
  v_def := replace(v_def, 'round(pr.sim, 3)', 'round(pr.sim::numeric, 3)');
  v_def := replace(v_def, 'round(pr.sim, 4)', 'round(pr.sim::numeric, 4)');

  EXECUTE v_def;
END;
$mig$;