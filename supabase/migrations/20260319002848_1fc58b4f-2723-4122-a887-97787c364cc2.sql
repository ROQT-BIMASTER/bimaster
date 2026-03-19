ALTER TABLE public.process_despacho_documento
  ADD COLUMN IF NOT EXISTS vinculo_projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vinculo_tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL;