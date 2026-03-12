
-- Add responsavel_id to existing doc vinculos table
ALTER TABLE public.china_documento_tarefa_vinculos
  ADD COLUMN IF NOT EXISTS responsavel_id uuid;

-- Create configurable category-responsible mapping table
CREATE TABLE public.china_categoria_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_key text NOT NULL,
  categoria_nome text NOT NULL,
  responsavel_id uuid NOT NULL,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(categoria_key, projeto_id)
);

-- Enable RLS
ALTER TABLE public.china_categoria_responsaveis ENABLE ROW LEVEL SECURITY;

-- RLS policies for china_categoria_responsaveis
CREATE POLICY "Authenticated users can read china_categoria_responsaveis"
  ON public.china_categoria_responsaveis FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert china_categoria_responsaveis"
  ON public.china_categoria_responsaveis FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update china_categoria_responsaveis"
  ON public.china_categoria_responsaveis FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete china_categoria_responsaveis"
  ON public.china_categoria_responsaveis FOR DELETE TO authenticated USING (true);
