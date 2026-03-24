
-- Create trigger to auto-log changes using existing contas_pagar_historico schema
CREATE OR REPLACE FUNCTION log_contas_pagar_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_val JSONB;
  new_val JSONB;
  key TEXT;
  ignored_cols TEXT[] := ARRAY['updated_at', 'created_at'];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_val := to_jsonb(OLD);
    new_val := to_jsonb(NEW);
    
    FOR key IN SELECT jsonb_object_keys(new_val)
    LOOP
      IF NOT (key = ANY(ignored_cols)) AND (old_val->>key IS DISTINCT FROM new_val->>key) THEN
        INSERT INTO contas_pagar_historico (conta_id, campo_alterado, valor_anterior, valor_novo, tipo_alteracao, usuario_id)
        VALUES (
          NEW.id::uuid,
          key,
          old_val->>key,
          new_val->>key,
          'UPDATE',
          auth.uid()
        );
      END IF;
    END LOOP;
    
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO contas_pagar_historico (conta_id, campo_alterado, valor_anterior, valor_novo, tipo_alteracao, usuario_id)
    VALUES (NEW.id::uuid, 'registro', NULL, 'Cadastro inicial', 'INSERT', auth.uid());
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_contas_pagar_audit ON contas_pagar;
CREATE TRIGGER trg_contas_pagar_audit
  AFTER INSERT OR UPDATE ON contas_pagar
  FOR EACH ROW EXECUTE FUNCTION log_contas_pagar_changes();
