
-- Audit log for task chat preference changes (mute/archive)
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_chat_preferencias_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tarefa_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('mute','unmute','archive','unarchive','bulk_mute','bulk_unmute','bulk_archive','bulk_unarchive')),
  previous_muted boolean,
  previous_archived boolean,
  new_muted boolean,
  new_archived boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ptc_pref_audit_user ON public.projeto_tarefa_chat_preferencias_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ptc_pref_audit_tarefa ON public.projeto_tarefa_chat_preferencias_audit(tarefa_id, created_at DESC);

GRANT SELECT, INSERT ON public.projeto_tarefa_chat_preferencias_audit TO authenticated;
GRANT ALL ON public.projeto_tarefa_chat_preferencias_audit TO service_role;

ALTER TABLE public.projeto_tarefa_chat_preferencias_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User reads own pref audit" ON public.projeto_tarefa_chat_preferencias_audit;
CREATE POLICY "User reads own pref audit"
  ON public.projeto_tarefa_chat_preferencias_audit
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR changed_by = auth.uid());

DROP POLICY IF EXISTS "User inserts own pref audit" ON public.projeto_tarefa_chat_preferencias_audit;
CREATE POLICY "User inserts own pref audit"
  ON public.projeto_tarefa_chat_preferencias_audit
  FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- Trigger that records each preference change
CREATE OR REPLACE FUNCTION public.trg_log_tarefa_chat_preferencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.user_id);
  v_prev_muted boolean := CASE WHEN TG_OP = 'UPDATE' THEN OLD.muted ELSE NULL END;
  v_prev_archived boolean := CASE WHEN TG_OP = 'UPDATE' THEN OLD.archived ELSE NULL END;
  v_action text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.muted,false) = COALESCE(NEW.muted,false)
     AND COALESCE(OLD.archived,false) = COALESCE(NEW.archived,false) THEN
    RETURN NEW;
  END IF;

  -- choose primary action label
  IF TG_OP = 'INSERT' THEN
    IF NEW.archived THEN v_action := 'archive';
    ELSIF NEW.muted THEN v_action := 'mute';
    ELSE v_action := 'unmute';
    END IF;
  ELSE
    IF COALESCE(OLD.archived,false) <> COALESCE(NEW.archived,false) THEN
      v_action := CASE WHEN NEW.archived THEN 'archive' ELSE 'unarchive' END;
    ELSE
      v_action := CASE WHEN NEW.muted THEN 'mute' ELSE 'unmute' END;
    END IF;
  END IF;

  INSERT INTO public.projeto_tarefa_chat_preferencias_audit
    (user_id, tarefa_id, changed_by, action,
     previous_muted, previous_archived, new_muted, new_archived)
  VALUES
    (NEW.user_id, NEW.tarefa_id, v_actor, v_action,
     v_prev_muted, v_prev_archived, NEW.muted, NEW.archived);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_tarefa_chat_preferencia ON public.projeto_tarefa_chat_preferencias;
CREATE TRIGGER trg_log_tarefa_chat_preferencia
AFTER INSERT OR UPDATE ON public.projeto_tarefa_chat_preferencias
FOR EACH ROW EXECUTE FUNCTION public.trg_log_tarefa_chat_preferencia();

-- Bulk preference setter
CREATE OR REPLACE FUNCTION public.rpc_tarefa_chat_set_preferencia_bulk(
  p_tarefa_ids uuid[],
  p_muted boolean DEFAULT NULL,
  p_archived boolean DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
  v_tarefa uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_tarefa_ids IS NULL OR array_length(p_tarefa_ids,1) IS NULL THEN RETURN 0; END IF;
  IF p_muted IS NULL AND p_archived IS NULL THEN RETURN 0; END IF;

  FOREACH v_tarefa IN ARRAY p_tarefa_ids LOOP
    INSERT INTO public.projeto_tarefa_chat_preferencias (user_id, tarefa_id, muted, archived, updated_at)
    VALUES (v_uid, v_tarefa, COALESCE(p_muted,false), COALESCE(p_archived,false), now())
    ON CONFLICT (user_id, tarefa_id) DO UPDATE
      SET muted = COALESCE(p_muted, public.projeto_tarefa_chat_preferencias.muted),
          archived = COALESCE(p_archived, public.projeto_tarefa_chat_preferencias.archived),
          updated_at = now();
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_tarefa_chat_set_preferencia_bulk(uuid[], boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_tarefa_chat_set_preferencia_bulk(uuid[], boolean, boolean) TO authenticated;
