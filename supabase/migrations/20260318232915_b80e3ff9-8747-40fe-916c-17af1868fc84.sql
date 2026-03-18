
ALTER TABLE public.process_doc_workflow_etapas 
  ADD COLUMN IF NOT EXISTS aprovadores_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS aprovadores_nomes text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS modulo_aprovacao text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS modulo_recusa text DEFAULT NULL;
