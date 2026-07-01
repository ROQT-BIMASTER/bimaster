CREATE TABLE IF NOT EXISTS public.projeto_tarefa_curtidas (
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tarefa_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_curtidas_tarefa ON public.projeto_tarefa_curtidas(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_curtidas_user ON public.projeto_tarefa_curtidas(user_id);

GRANT SELECT, INSERT, DELETE ON public.projeto_tarefa_curtidas TO authenticated;
GRANT ALL ON public.projeto_tarefa_curtidas TO service_role;

ALTER TABLE public.projeto_tarefa_curtidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read curtidas"
  ON public.projeto_tarefa_curtidas FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can insert own curtidas"
  ON public.projeto_tarefa_curtidas FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own curtidas"
  ON public.projeto_tarefa_curtidas FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.rpc_toggle_curtida_tarefa(p_tarefa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existed boolean;
  v_total int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  DELETE FROM public.projeto_tarefa_curtidas
   WHERE tarefa_id = p_tarefa_id AND user_id = v_user
  RETURNING true INTO v_existed;

  IF v_existed IS NULL THEN
    INSERT INTO public.projeto_tarefa_curtidas(tarefa_id, user_id)
    VALUES (p_tarefa_id, v_user);
    v_existed := false;
  END IF;

  SELECT count(*) INTO v_total FROM public.projeto_tarefa_curtidas WHERE tarefa_id = p_tarefa_id;

  RETURN jsonb_build_object('liked', NOT v_existed, 'total', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_toggle_curtida_tarefa(uuid) TO authenticated;