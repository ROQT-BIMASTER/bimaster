
-- 1. Add estagio column to projeto_tarefas
ALTER TABLE public.projeto_tarefas ADD COLUMN IF NOT EXISTS estagio text DEFAULT null;

-- 2. Create projeto_tarefa_comentarios
CREATE TABLE public.projeto_tarefa_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conteudo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tarefa_comentarios_tarefa ON public.projeto_tarefa_comentarios(tarefa_id);
ALTER TABLE public.projeto_tarefa_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read comments" ON public.projeto_tarefa_comentarios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own comments" ON public.projeto_tarefa_comentarios
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.projeto_tarefa_comentarios
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Create projeto_tarefa_anexos
CREATE TABLE public.projeto_tarefa_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  storage_path text NOT NULL,
  tipo_arquivo text,
  tamanho bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tarefa_anexos_tarefa ON public.projeto_tarefa_anexos(tarefa_id);
ALTER TABLE public.projeto_tarefa_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read attachments" ON public.projeto_tarefa_anexos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own attachments" ON public.projeto_tarefa_anexos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own attachments" ON public.projeto_tarefa_anexos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('projeto-anexos', 'projeto-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload projeto anexos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'projeto-anexos');
CREATE POLICY "Authenticated users can read projeto anexos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'projeto-anexos');
CREATE POLICY "Users can delete own projeto anexos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'projeto-anexos');

-- 5. Auto-generate task codes
CREATE OR REPLACE FUNCTION public.generate_tarefa_codigo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  projeto_prefixo text;
  seq_num integer;
BEGIN
  -- Get first 2 chars of project name as prefix
  SELECT UPPER(LEFT(REGEXP_REPLACE(nome, '[^a-zA-Z]', '', 'g'), 2))
  INTO projeto_prefixo
  FROM public.projetos
  WHERE id = NEW.projeto_id;

  IF projeto_prefixo IS NULL OR projeto_prefixo = '' THEN
    projeto_prefixo := 'PR';
  END IF;

  -- Get next sequential number for this project
  SELECT COALESCE(MAX(
    CASE WHEN codigo ~ '[0-9]+$' THEN
      CAST(SUBSTRING(codigo FROM '[0-9]+$') AS integer)
    ELSE 0 END
  ), 0) + 1
  INTO seq_num
  FROM public.projeto_tarefas
  WHERE projeto_id = NEW.projeto_id AND codigo IS NOT NULL;

  NEW.codigo := projeto_prefixo || '-' || LPAD(seq_num::text, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_tarefa_codigo
  BEFORE INSERT ON public.projeto_tarefas
  FOR EACH ROW
  WHEN (NEW.codigo IS NULL)
  EXECUTE FUNCTION public.generate_tarefa_codigo();
