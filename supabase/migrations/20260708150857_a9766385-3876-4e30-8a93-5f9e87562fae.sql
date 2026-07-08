
ALTER TABLE public.projeto_tarefa_comentarios
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

DROP POLICY IF EXISTS "Members can update own comments 24h" ON public.projeto_tarefa_comentarios;
CREATE POLICY "Members can update own comments 24h"
  ON public.projeto_tarefa_comentarios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND created_at > now() - interval '24 hours')
  WITH CHECK (auth.uid() = user_id AND created_at > now() - interval '24 hours');

CREATE OR REPLACE FUNCTION public.tg_projeto_tarefa_comentario_edit_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tarefa_id IS DISTINCT FROM OLD.tarefa_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Somente o conteúdo do comentário pode ser alterado';
  END IF;
  IF NEW.conteudo IS DISTINCT FROM OLD.conteudo THEN
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projeto_tarefa_comentario_edit_guard ON public.projeto_tarefa_comentarios;
CREATE TRIGGER trg_projeto_tarefa_comentario_edit_guard
BEFORE UPDATE ON public.projeto_tarefa_comentarios
FOR EACH ROW EXECUTE FUNCTION public.tg_projeto_tarefa_comentario_edit_guard();
