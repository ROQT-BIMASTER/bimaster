-- Fonte única do limite de upload no back-end.
-- Espelha `UPLOAD_MAX_BYTES` em src/lib/upload/limits.ts (1 GB).
-- Para alterar o teto: atualize esta função E `UPLOAD_MAX_BYTES` no front.
CREATE OR REPLACE FUNCTION public.upload_max_bytes()
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 1073741824::bigint;  -- 1 GB
$$;

GRANT EXECUTE ON FUNCTION public.upload_max_bytes() TO authenticated, service_role;

-- Trigger de anexos passa a consultar a função em vez de hardcodar o valor.
CREATE OR REPLACE FUNCTION public.enforce_projeto_anexos_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ext text;
  v_max bigint := public.upload_max_bytes();
BEGIN
  v_ext := lower(regexp_replace(coalesce(NEW.nome, ''), '^.*\.', ''));

  IF NEW.tamanho IS NOT NULL AND NEW.tamanho > v_max THEN
    BEGIN
      INSERT INTO public.projeto_anexos_upload_audit (
        user_id, tarefa_id, nome, tamanho, tipo_arquivo, rejection_code, rejection_reason
      ) VALUES (
        NEW.user_id, NEW.tarefa_id, NEW.nome, NEW.tamanho, NEW.tipo_arquivo,
        'size_exceeded',
        format('Arquivo excede o limite unificado de %s bytes (%.2f MB enviados).',
               v_max, NEW.tamanho::numeric / (1024 * 1024))
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- auditoria best-effort
    END;
    RAISE EXCEPTION 'Arquivo excede o limite unificado do sistema (% bytes).', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;