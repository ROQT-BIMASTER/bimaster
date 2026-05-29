CREATE OR REPLACE FUNCTION public.set_projeto_criador_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  NEW.criador_id := auth.uid();

  IF NEW.status IS NULL THEN
    NEW.status := 'ativo';
  END IF;

  IF NEW.visibilidade IS NULL THEN
    NEW.visibilidade := 'equipe';
  END IF;

  IF NEW.tipo IS NULL OR btrim(NEW.tipo) = '' THEN
    NEW.tipo := 'generico';
  END IF;

  IF NEW.cor IS NULL OR btrim(NEW.cor) = '' THEN
    NEW.cor := '#6366f1';
  END IF;

  IF NEW.icone IS NULL OR btrim(NEW.icone) = '' THEN
    NEW.icone := 'folder';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_projeto_criador_id ON public.projetos;
CREATE TRIGGER trg_set_projeto_criador_id
BEFORE INSERT ON public.projetos
FOR EACH ROW
EXECUTE FUNCTION public.set_projeto_criador_id();

DROP POLICY IF EXISTS "Authenticated users can insert own projetos" ON public.projetos;
CREATE POLICY "Authenticated users can insert projetos"
ON public.projetos
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND criador_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT ALL ON public.projetos TO service_role;