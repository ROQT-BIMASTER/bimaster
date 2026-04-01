
CREATE OR REPLACE FUNCTION public.generate_tarefa_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_count INT;
BEGIN
  v_prefix := COALESCE(NEW.tipo_tarefa, 'GEN');
  SELECT COUNT(*) + 1 INTO v_count FROM projeto_tarefas WHERE tipo_tarefa = NEW.tipo_tarefa;
  NEW.codigo := UPPER(LEFT(v_prefix, 3)) || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN NEW;
END;
$$;
