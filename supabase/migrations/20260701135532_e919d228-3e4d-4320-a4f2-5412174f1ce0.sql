CREATE TABLE public.mkt_windsor_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  windsor_account_id text NOT NULL,
  account_name text,
  tipo text CHECK (tipo IN ('organico','pago')),
  plataforma text,
  marca_id uuid NULL REFERENCES public.mkt_marcas(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  primeira_vez timestamptz NOT NULL DEFAULT now(),
  ultima_vez timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, windsor_account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_windsor_map TO authenticated;
GRANT ALL ON public.mkt_windsor_map TO service_role;

ALTER TABLE public.mkt_windsor_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_windsor_map admin select"
  ON public.mkt_windsor_map FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "mkt_windsor_map admin insert"
  ON public.mkt_windsor_map FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "mkt_windsor_map admin update"
  ON public.mkt_windsor_map FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "mkt_windsor_map admin delete"
  ON public.mkt_windsor_map FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_mkt_windsor_map_marca_id ON public.mkt_windsor_map (marca_id);