
CREATE TABLE public.projeto_tarefa_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE NOT NULL,
  nome_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo_arquivo TEXT,
  tamanho BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.projeto_tarefa_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage task documents"
  ON public.projeto_tarefa_documentos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('projeto-documentos', 'projeto-documentos', true);

CREATE POLICY "Auth users upload projeto docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'projeto-documentos');
CREATE POLICY "Auth users read projeto docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'projeto-documentos');
