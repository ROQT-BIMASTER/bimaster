-- Bucket para documentos de aprovação de verbas
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-budget-docs', 'trade-budget-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket
CREATE POLICY "Usuários autenticados podem ver docs de verbas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trade-budget-docs' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem fazer upload de docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'trade-budget-docs' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar seus docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'trade-budget-docs' AND auth.role() = 'authenticated');

-- Tabela para rastrear documentos anexados às verbas
CREATE TABLE public.trade_budget_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.trade_budgets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trade_budget_documents ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Todos autenticados podem ver documentos de verbas"
  ON public.trade_budget_documents FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem criar documentos"
  ON public.trade_budget_documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar documentos"
  ON public.trade_budget_documents FOR DELETE
  USING (auth.role() = 'authenticated');