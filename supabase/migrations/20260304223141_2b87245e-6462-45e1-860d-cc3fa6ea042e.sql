
-- Track task section movements (ghost trail in previous section)
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  secao_origem_id uuid NOT NULL REFERENCES public.projeto_secoes(id) ON DELETE CASCADE,
  secao_destino_id uuid NOT NULL REFERENCES public.projeto_secoes(id) ON DELETE CASCADE,
  movido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_tarefa_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task movements" ON public.projeto_tarefa_movimentacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create task movements" ON public.projeto_tarefa_movimentacoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_tarefa_movimentacoes_secao ON public.projeto_tarefa_movimentacoes(secao_origem_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tarefa_movimentacoes_tarefa ON public.projeto_tarefa_movimentacoes(tarefa_id);
