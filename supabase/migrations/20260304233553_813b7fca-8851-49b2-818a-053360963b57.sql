
CREATE TABLE public.projeto_tarefa_produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tarefa_id, produto_id)
);

ALTER TABLE public.projeto_tarefa_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tarefa produtos"
  ON public.projeto_tarefa_produtos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tarefa produtos"
  ON public.projeto_tarefa_produtos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tarefa produtos"
  ON public.projeto_tarefa_produtos FOR DELETE TO authenticated USING (true);
