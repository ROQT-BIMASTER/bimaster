CREATE TABLE public.novidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  midia_url text,
  midia_tipo text CHECK (midia_tipo IN ('imagem','video')),
  link_destino text,
  versao text,
  publicado boolean NOT NULL DEFAULT false,
  publicado_em timestamptz,
  ordem integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.novidades_visualizacoes (
  user_id uuid NOT NULL,
  novidade_id uuid NOT NULL REFERENCES public.novidades(id) ON DELETE CASCADE,
  visto_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, novidade_id)
);

CREATE INDEX idx_novidades_publicado ON public.novidades (publicado, publicado_em DESC, ordem);
CREATE INDEX idx_novidades_vis_user ON public.novidades_visualizacoes (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.novidades TO authenticated;
GRANT ALL ON public.novidades TO service_role;
GRANT SELECT, INSERT, DELETE ON public.novidades_visualizacoes TO authenticated;
GRANT ALL ON public.novidades_visualizacoes TO service_role;

ALTER TABLE public.novidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novidades_visualizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "novidades_select_publicadas" ON public.novidades
  FOR SELECT TO authenticated
  USING (publicado = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "novidades_insert_admin" ON public.novidades
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "novidades_update_admin" ON public.novidades
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "novidades_delete_admin" ON public.novidades
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "novidades_vis_select_own" ON public.novidades_visualizacoes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "novidades_vis_insert_own" ON public.novidades_visualizacoes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "novidades_vis_delete_own" ON public.novidades_visualizacoes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_novidades_updated_at
  BEFORE UPDATE ON public.novidades
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();