
-- 1. Tabela cofre do projeto
CREATE TABLE IF NOT EXISTS public.projeto_cofre_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  categoria text NOT NULL DEFAULT 'geral',
  fornecedor_nome text,
  lote text,
  data_entrega date,
  status text NOT NULL DEFAULT 'recebido',
  storage_path text,
  mime_type text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_cofre_documentos_projeto
  ON public.projeto_cofre_documentos(projeto_id, created_at DESC);

ALTER TABLE public.projeto_cofre_documentos ENABLE ROW LEVEL SECURITY;

-- Acesso: membros do projeto OU admin
CREATE POLICY "cofre_doc_select_members"
ON public.projeto_cofre_documentos FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projeto_membros pm
          WHERE pm.projeto_id = projeto_cofre_documentos.projeto_id
            AND pm.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "cofre_doc_insert_members"
ON public.projeto_cofre_documentos FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM public.projeto_membros pm
            WHERE pm.projeto_id = projeto_cofre_documentos.projeto_id
              AND pm.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "cofre_doc_update_members"
ON public.projeto_cofre_documentos FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projeto_membros pm
          WHERE pm.projeto_id = projeto_cofre_documentos.projeto_id
            AND pm.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "cofre_doc_delete_members"
ON public.projeto_cofre_documentos FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Trigger updated_at
CREATE TRIGGER trg_projeto_cofre_documentos_updated
BEFORE UPDATE ON public.projeto_cofre_documentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_cofre_documentos;

-- 2. metadata em briefing_comentarios
ALTER TABLE public.briefing_comentarios
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. metadata em projeto_tarefa_comentarios
ALTER TABLE public.projeto_tarefa_comentarios
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
