
-- 1) Tabela principal de pareceres
CREATE TABLE IF NOT EXISTS public.china_submissao_pareceres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid NOT NULL,
  autor_id uuid NOT NULL,
  autor_lado text NOT NULL CHECK (autor_lado IN ('brasil','china')),
  texto text NOT NULL CHECK (length(btrim(texto)) > 0),
  critico boolean NOT NULL DEFAULT false,
  traducao_pt text,
  traducao_en text,
  traducao_zh text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_china_subm_pareceres_subm ON public.china_submissao_pareceres(submissao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_china_subm_pareceres_autor ON public.china_submissao_pareceres(autor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.china_submissao_pareceres TO authenticated;
GRANT ALL ON public.china_submissao_pareceres TO service_role;

ALTER TABLE public.china_submissao_pareceres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "china_submissao_pareceres select"
  ON public.china_submissao_pareceres FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "china_submissao_pareceres insert"
  ON public.china_submissao_pareceres FOR INSERT
  TO authenticated
  WITH CHECK (autor_id = auth.uid());

CREATE POLICY "china_submissao_pareceres update"
  ON public.china_submissao_pareceres FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (autor_id = auth.uid() AND created_at > now() - interval '15 minutes')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (autor_id = auth.uid() AND created_at > now() - interval '15 minutes')
  );

CREATE POLICY "china_submissao_pareceres delete"
  ON public.china_submissao_pareceres FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR autor_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public._tg_china_subm_pareceres_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_china_subm_pareceres_updated_at ON public.china_submissao_pareceres;
CREATE TRIGGER tg_china_subm_pareceres_updated_at
  BEFORE UPDATE ON public.china_submissao_pareceres
  FOR EACH ROW EXECUTE FUNCTION public._tg_china_subm_pareceres_updated_at();

-- 2) Anexos
CREATE TABLE IF NOT EXISTS public.china_submissao_parecer_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parecer_id uuid NOT NULL REFERENCES public.china_submissao_pareceres(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome_arquivo text NOT NULL,
  mime text,
  tamanho bigint,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_china_subm_parecer_anexos_parecer ON public.china_submissao_parecer_anexos(parecer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.china_submissao_parecer_anexos TO authenticated;
GRANT ALL ON public.china_submissao_parecer_anexos TO service_role;

ALTER TABLE public.china_submissao_parecer_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "china_subm_parecer_anexos select"
  ON public.china_submissao_parecer_anexos FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "china_subm_parecer_anexos insert"
  ON public.china_submissao_parecer_anexos FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "china_subm_parecer_anexos delete"
  ON public.china_submissao_parecer_anexos FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR uploaded_by = auth.uid()
  );

-- 3) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.china_submissao_pareceres;
ALTER PUBLICATION supabase_realtime ADD TABLE public.china_submissao_parecer_anexos;
