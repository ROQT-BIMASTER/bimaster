CREATE OR REPLACE FUNCTION public.enforce_projeto_anexos_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_max bigint := public.upload_max_bytes();
BEGIN
  -- Este validador pertence aos metadados de anexos de tarefas. Se um gatilho
  -- legado ainda estiver acoplado a storage.objects, não deve tentar ler campos
  -- como nome/tamanho/tarefa_id que não existem naquela tabela.
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME <> 'projeto_tarefa_anexos' THEN
    RETURN NEW;
  END IF;

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
      NULL;
    END;
    RAISE EXCEPTION 'Arquivo excede o limite unificado do sistema (% bytes).', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_projeto_anexos_limits ON public.projeto_tarefa_anexos;
CREATE TRIGGER trg_enforce_projeto_anexos_limits
BEFORE INSERT OR UPDATE ON public.projeto_tarefa_anexos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_projeto_anexos_limits();