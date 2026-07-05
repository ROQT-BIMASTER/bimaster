DO $mig$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc WHERE proname='fn_despesa_detectar' AND pronamespace='public'::regnamespace;

  v_def := replace(v_def,
    'd.departamento_id::text || ''|'' || d.fornecedor_codigo || ''|''
          || to_char(date_trunc(''quarter'', current_date), ''YYYY'') || ''-Q''
          || to_char(date_trunc(''quarter'', current_date), ''Q'')',
    'COALESCE(d.empresa_id::text, ''0'') || ''|'' || d.departamento_id::text || ''|'' || d.fornecedor_codigo || ''|''
          || to_char(date_trunc(''quarter'', current_date), ''YYYY'') || ''-Q''
          || to_char(date_trunc(''quarter'', current_date), ''Q'')');

  EXECUTE v_def;
END;
$mig$;