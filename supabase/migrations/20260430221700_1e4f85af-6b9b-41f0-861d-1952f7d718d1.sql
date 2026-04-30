CREATE TABLE public.projeto_tarefa_notas_pessoais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tarefa_id, user_id)
);

CREATE INDEX idx_notas_pessoais_user_tarefa ON public.projeto_tarefa_notas_pessoais (user_id, tarefa_id);
CREATE INDEX idx_notas_pessoais_tarefa ON public.projeto_tarefa_notas_pessoais (tarefa_id);

ALTER TABLE public.projeto_tarefa_notas_pessoais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own personal notes"
  ON public.projeto_tarefa_notas_pessoais FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own personal notes"
  ON public.projeto_tarefa_notas_pessoais FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own personal notes"
  ON public.projeto_tarefa_notas_pessoais FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own personal notes"
  ON public.projeto_tarefa_notas_pessoais FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_notas_pessoais_updated
  BEFORE UPDATE ON public.projeto_tarefa_notas_pessoais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();