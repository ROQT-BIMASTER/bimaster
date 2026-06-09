ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS rr_produto_notion_id  text NULL
    REFERENCES public.rr_produtos(notion_page_id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rr_variante_notion_id text NULL
    REFERENCES public.rr_variantes(notion_page_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sprint         text NULL,
  ADD COLUMN IF NOT EXISTS rrtask_page_id text NULL;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_rr_produto
  ON public.projeto_tarefas(rr_produto_notion_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_rrtask_page
  ON public.projeto_tarefas(rrtask_page_id);